import { AzureOpenAI } from 'openai';
import { getContainer } from './azure/cosmos';
import { modelConfigs, ModelType } from '../schema';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const TOKEN_USAGE_CONTAINER = 'token-usage';

// Keywords for thinking budget adjustment
const ULTRA_THINKING_KEYWORD = 'ultrathink';

const defaultOutputTokenCount = 8192;

export interface ConverseInput {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | 'required' | { type: 'function'; function: { name: string } };
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ConverseResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

let openAIClient: AzureOpenAI | null = null;

const getOpenAIClient = () => {
  if (!openAIClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set');
    }

    openAIClient = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: '2024-08-01-preview',
    });
  }
  return openAIClient;
};

export const azureOpenAIConverse = async (
  workerId: string,
  modelTypes: ModelType[],
  input: ConverseInput,
  maxTokensExceededCount = 0
): Promise<{ response: ConverseResponse; thinkingBudget?: number }> => {
  if (maxTokensExceededCount > 5) {
    throw new Error(`Max tokens exceeded too many times (${maxTokensExceededCount})`);
  }

  try {
    const modelType = chooseRandom(modelTypes);
    const modelConfig = modelConfigs[modelType];
    const client = getOpenAIClient();

    console.log(`Using Azure OpenAI model: ${modelConfig.modelId}`);

    const { processedInput, thinkingBudget } = preProcessInput(input, modelType, maxTokensExceededCount);

    const response = (await client.chat.completions.create({
      model: modelConfig.deploymentName || modelConfig.modelId,
      messages: processedInput.messages,
      tools: processedInput.tools,
      tool_choice: processedInput.toolChoice,
      temperature: processedInput.temperature ?? 0.7,
      max_tokens: processedInput.maxTokens,
    })) as unknown as ConverseResponse;

    // Track token usage for analytics
    await trackTokenUsage(workerId, modelConfig.modelId, response);

    return { response, thinkingBudget };
  } catch (error) {
    console.error('Azure OpenAI API error:', error);
    throw error;
  }
};

const shouldUltraThink = (input: ConverseInput): boolean => {
  const messages = input.messages || [];
  const lastUserMessage = messages.filter((message) => message.role === 'user').pop();

  if (!lastUserMessage || typeof lastUserMessage.content !== 'string') {
    return false;
  }

  const messageText = lastUserMessage.content.toLowerCase();
  return messageText.includes(ULTRA_THINKING_KEYWORD);
};

const preProcessInput = (
  input: ConverseInput,
  modelType: ModelType,
  maxTokensExceededCount: number
): { processedInput: ConverseInput; thinkingBudget?: number } => {
  const modelConfig = modelConfigs[modelType];
  const processedInput = structuredClone(input);

  // Set maximum number of output tokens
  const adjustedMaxToken = Math.min(modelConfig.maxOutputTokens, defaultOutputTokenCount * 2 ** maxTokensExceededCount);
  processedInput.maxTokens = adjustedMaxToken;

  let thinkingBudget: number | undefined = undefined;

  // Check if ultra thinking is needed
  const enableUltraThink = shouldUltraThink(input);
  if (enableUltraThink) {
    thinkingBudget = Math.min(Math.floor(modelConfig.maxOutputTokens / 2), 31999);
    // Adjust max tokens for thinking
    processedInput.maxTokens = Math.max(adjustedMaxToken, Math.min(thinkingBudget * 2, modelConfig.maxOutputTokens));
  }

  return { processedInput, thinkingBudget };
};

const chooseRandom = <T>(choices: T[]): T => {
  return choices[Math.floor(Math.random() * choices.length)];
};

const trackTokenUsage = async (workerId: string, modelId: string, response: ConverseResponse) => {
  if (!response.usage) {
    console.warn('No usage information in response');
    return;
  }

  const { prompt_tokens, completion_tokens, total_tokens } = response.usage;

  try {
    const container = getContainer(TOKEN_USAGE_CONTAINER);
    const PK = `token-${workerId}`;
    const SK = modelId;
    const id = `${PK}#${SK}`;

    // Try to get existing item
    try {
      const { resource: existingItem } = await container.item(id, PK).read();

      if (existingItem) {
        // Update (increment token counts) if item exists
        existingItem.inputToken = (existingItem.inputToken || 0) + (prompt_tokens || 0);
        existingItem.outputToken = (existingItem.outputToken || 0) + (completion_tokens || 0);
        existingItem.totalToken = (existingItem.totalToken || 0) + (total_tokens || 0);

        await container.item(id, PK).replace(existingItem);
      }
    } catch (error: any) {
      if (error.code === 404) {
        // Create new item if it doesn't exist yet
        await container.items.create({
          id,
          PK,
          SK,
          inputToken: prompt_tokens || 0,
          outputToken: completion_tokens || 0,
          totalToken: total_tokens || 0,
        });
      } else {
        throw error;
      }
    }
  } catch (error) {
    // do not throw error to avoid affecting the primary process
    console.error('Error tracking token usage:', error);
  }
};
