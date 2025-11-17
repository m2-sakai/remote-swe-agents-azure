import { reportProgressTool } from '../tools/report-progress';
import { getContainer, ContainerName } from './azure';

export const renderToolResult = (props: { toolResult: string; forceReport: boolean }) => {
  return `
<result>
${props.toolResult}
</result>
<command>
${props.forceReport ? `Long time has passed since you sent the last message. Please use ${reportProgressTool.name} tool to send a response asap.` : ''}
</command>
`.trim();
};

export const renderUserMessage = (props: { message: string }) => {
  return `
<user_message>
${props.message}
</user_message>
<command>
User sent you a message. Please use ${reportProgressTool.name} tool to send a response asap.
</command>
`.trim();
};

const CONTAINER_NAME = ContainerName;

/**
 * Global config keys for Cosmos DB
 */
export const GlobalConfigKeys = {
  PK: 'global-config',
  PromptSK: 'prompt',
};

/**
 * Type definition for common prompt data
 */
export interface CommonPromptData {
  additionalSystemPrompt: string;
}

/**
 * Read the common prompt from Cosmos DB
 * @returns Promise with the common prompt data or null if not found
 */
export const readCommonPrompt = async (): Promise<CommonPromptData | null> => {
  try {
    const container = getContainer(CONTAINER_NAME);
    const PK = GlobalConfigKeys.PK;
    const SK = GlobalConfigKeys.PromptSK;
    const id = `${PK}#${SK}`;

    const { resource: item } = await container.item(id, PK).read();

    if (!item) {
      return null;
    }

    return {
      additionalSystemPrompt: item.additionalSystemPrompt || '',
    };
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    console.error('Error reading common prompt:', error);
    return null;
  }
};

/**
 * Write the common prompt to Cosmos DB
 * @param data The common prompt data to write
 * @returns Promise that resolves when the data is written
 */
export const writeCommonPrompt = async (data: CommonPromptData): Promise<void> => {
  const container = getContainer(CONTAINER_NAME);
  const PK = GlobalConfigKeys.PK;
  const SK = GlobalConfigKeys.PromptSK;
  const id = `${PK}#${SK}`;

  await container.items.upsert({
    id,
    PK,
    SK,
    additionalSystemPrompt: data.additionalSystemPrompt,
  });
};
