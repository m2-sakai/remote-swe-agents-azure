/**
 * AWS Bedrock → Azure OpenAI 互換レイヤー
 * Bedrock の型と API を Azure OpenAI に変換
 */
import { azureOpenAIConverse, ConverseInput } from './converse';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// Bedrock 互換の型定義（エクスポート用）
export type Message = BedrockMessage;
export type { ContentBlock, ToolResultContentBlock, Tool, ToolSpec };
export type { ConverseCommandInput, ConverseCommandOutput };

// 内部型定義
interface BedrockMessage {
  role: 'user' | 'assistant' | string;
  content?: ContentBlock[];
}

type ContentBlock =
  | { text?: string }
  | { image?: { format: string; source: { bytes: Buffer } } }
  | { toolUse?: { toolUseId: string; name: string; input: any } }
  | { toolResult?: { toolUseId: string; content: ToolResultContentBlock[] } }
  | { cachePoint?: { type: 'default' } }
  | { reasoningContent?: { reasoningText?: { text?: string } } };

type ToolResultContentBlock = { text: string } | { image: { format: string; source: { bytes: Buffer } } };

interface ToolSpec {
  name: string;
  description: string;
  inputSchema: {
    json: any;
  };
}

interface Tool {
  toolSpec?: ToolSpec;
  cachePoint?: { type: 'default' };
}

interface ConverseCommandInput {
  messages: BedrockMessage[];
  system?: Array<{ text?: string; cachePoint?: { type: 'default' } }>;
  toolConfig?: {
    tools?: Tool[];
  };
}

interface ConverseCommandOutput {
  output?: {
    message?: BedrockMessage;
  };
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadInputTokens?: number;
    cacheWriteInputTokens?: number;
  };
}

// 変換関数
const convertMessagesToOpenAI = (messages: BedrockMessage[]): ChatCompletionMessageParam[] => {
  const result: ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (!msg.content || msg.content.length === 0) continue;

    // cachePoint や reasoningContent は無視
    const contentBlocks = msg.content.filter((block) => !('cachePoint' in block) && !('reasoningContent' in block));

    if (msg.role === 'user') {
      // toolResult がある場合
      const toolResults = contentBlocks.filter((block) => 'toolResult' in block);
      if (toolResults.length > 0) {
        for (const block of toolResults) {
          if ('toolResult' in block && block.toolResult) {
            const toolResult = block.toolResult;
            const content = toolResult.content.map((c) => ('text' in c ? c.text : '[Image]')).join('\n');

            result.push({
              role: 'tool',
              tool_call_id: toolResult.toolUseId,
              content: content,
            });
          }
        }
        continue;
      }

      // 通常のユーザーメッセージ
      const textBlocks = contentBlocks.filter((block) => 'text' in block);
      const imageBlocks = contentBlocks.filter((block) => 'image' in block);

      if (textBlocks.length > 0 || imageBlocks.length > 0) {
        const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];

        for (const block of textBlocks) {
          if ('text' in block && block.text) {
            content.push({ type: 'text', text: block.text });
          }
        }

        for (const block of imageBlocks) {
          if ('image' in block && block.image) {
            const base64 = block.image.source.bytes.toString('base64');
            const mimeType = block.image.format === 'png' ? 'image/png' : 'image/jpeg';
            content.push({
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            });
          }
        }

        result.push({
          role: 'user',
          content: content.length === 1 && content[0].type === 'text' ? content[0].text : (content as any),
        });
      }
    } else if (msg.role === 'assistant') {
      // toolUse がある場合
      const toolUses = contentBlocks.filter((block) => 'toolUse' in block);
      if (toolUses.length > 0) {
        const tool_calls = toolUses
          .map((block) => {
            if ('toolUse' in block && block.toolUse) {
              return {
                id: block.toolUse.toolUseId,
                type: 'function' as const,
                function: {
                  name: block.toolUse.name,
                  arguments: JSON.stringify(block.toolUse.input),
                },
              };
            }
            return null;
          })
          .filter((t) => t !== null);

        result.push({
          role: 'assistant',
          content: null,
          tool_calls: tool_calls as any,
        });
        continue;
      }

      // 通常のアシスタントメッセージ
      const textBlocks = contentBlocks.filter((block) => 'text' in block);
      if (textBlocks.length > 0) {
        const text = textBlocks.map((block) => ('text' in block ? block.text : '')).join('\n');
        result.push({
          role: 'assistant',
          content: text,
        });
      }
    }
  }

  return result;
};

const convertToolsToOpenAI = (tools?: Tool[]): ChatCompletionTool[] | undefined => {
  if (!tools || tools.length === 0) return undefined;

  const filtered = tools.filter((t) => t.toolSpec && !t.cachePoint);
  if (filtered.length === 0) return undefined;

  return filtered.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.toolSpec!.name,
      description: tool.toolSpec!.description,
      parameters: tool.toolSpec!.inputSchema.json,
    },
  }));
};

const convertSystemToOpenAI = (system?: Array<{ text?: string; cachePoint?: { type: 'default' } }>): string => {
  if (!system || system.length === 0) return '';
  return system
    .filter((s) => s.text)
    .map((s) => s.text)
    .join('\n');
};

const convertResponseToBedrock = (
  response: any,
  originalMessages: BedrockMessage[]
): { response: ConverseCommandOutput; thinkingBudget?: number } => {
  const choice = response.choices?.[0];
  if (!choice) {
    throw new Error('No choices in response');
  }

  const message: BedrockMessage = {
    role: 'assistant',
    content: [],
  };

  // tool_calls がある場合
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    for (const toolCall of choice.message.tool_calls) {
      message.content!.push({
        toolUse: {
          toolUseId: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        },
      });
    }
  } else if (choice.message.content) {
    // 通常のテキスト応答
    message.content!.push({
      text: choice.message.content,
    });
  }

  // stopReason の変換
  let stopReason: ConverseCommandOutput['stopReason'] = 'end_turn';
  if (choice.finish_reason === 'tool_calls') {
    stopReason = 'tool_use';
  } else if (choice.finish_reason === 'length') {
    stopReason = 'max_tokens';
  } else if (choice.finish_reason === 'stop') {
    stopReason = 'end_turn';
  }

  return {
    response: {
      output: { message },
      stopReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    },
    thinkingBudget: undefined,
  };
};

export const bedrockConverse = async (
  workerId: string,
  modelTypes: any[],
  input: ConverseCommandInput,
  maxTokensExceededCount = 0
): Promise<{ response: ConverseCommandOutput; thinkingBudget?: number }> => {
  // Bedrock形式からOpenAI形式に変換
  const messages = convertMessagesToOpenAI(input.messages);
  const tools = convertToolsToOpenAI(input.toolConfig?.tools);
  const system = convertSystemToOpenAI(input.system);

  const converseInput: ConverseInput = {
    messages,
    tools,
    toolChoice: tools && tools.length > 0 ? 'auto' : undefined,
    system,
  };

  // Azure OpenAI を呼び出し
  const { response: openAIResponse, thinkingBudget } = await azureOpenAIConverse(
    workerId,
    modelTypes,
    converseInput,
    maxTokensExceededCount
  );

  // OpenAI形式からBedrock形式に変換
  return convertResponseToBedrock(openAIResponse, input.messages);
};

// エラー型もエクスポート（互換性のため）
export class ThrottlingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThrottlingException';
  }
}
