import { z } from 'zod';
import { getContainer, ContainerName } from './azure';
import { AgentStatus, SessionItem, sessionItemSchema } from '../schema';
import { azureOpenAIConverse } from './converse';

const CONTAINER_NAME = ContainerName;

/**
 * Get session information from Cosmos DB
 * @param workerId Worker ID to fetch session information for
 * @returns Session information including instance status
 */
export async function getSession(workerId: string): Promise<SessionItem | undefined> {
  try {
    const container = getContainer(CONTAINER_NAME);
    const PK = 'sessions';
    const { resource } = await container.item(workerId, PK).read<SessionItem>();
    return resource;
  } catch (error: any) {
    if (error.code === 404) {
      return undefined;
    }
    throw error;
  }
}

export const getSessions = async (
  limit: number = 50,
  range?: { startDate: number; endDate: number }
): Promise<SessionItem[]> => {
  const container = getContainer(CONTAINER_NAME);

  let querySpec: any = {
    query: 'SELECT * FROM c WHERE c.PK = @pk ORDER BY c.LSI1 DESC',
    parameters: [{ name: '@pk', value: 'sessions' }],
  };

  // Add date range filter if provided
  if (range) {
    const startTimestamp = String(range.startDate).padStart(15, '0');
    const endTimestamp = String(range.endDate).padStart(15, '0');

    querySpec.query =
      'SELECT * FROM c WHERE c.PK = @pk AND c.LSI1 >= @startDate AND c.LSI1 <= @endDate ORDER BY c.LSI1 DESC';
    querySpec.parameters.push({ name: '@startDate', value: startTimestamp }, { name: '@endDate', value: endTimestamp });
  }

  const { resources } = await container.items
    .query<SessionItem>(querySpec, { maxItemCount: limit === 0 ? undefined : limit })
    .fetchAll();

  return resources.filter((session) => !session.isHidden);
};

/**
 * Update agent status for a session
 * @param workerId Worker ID of the session to update
 * @param agentStatus New agent status
 */
export const updateSessionAgentStatus = async (workerId: string, agentStatus: AgentStatus): Promise<void> => {
  await updateSession(workerId, { agentStatus });
};

/**
 * Update isHidden field for a session
 * @param workerId Worker ID of the session to update
 * @param isHidden Whether the session should be hidden
 */
export const updateSessionVisibility = async (workerId: string, isHidden: boolean): Promise<void> => {
  await updateSession(workerId, { isHidden });
};

/**
 * Generate a session title using Bedrock Claude Haiku model
 * @param workerId Worker ID of the session to update (to track token usage)
 * @param message The message content to generate title from
 * @returns A generated title (10 characters or less)
 */
export const generateSessionTitle = async (workerId: string, message: string): Promise<string> => {
  try {
    console.log(message);
    const prompt = `
Based on the following chat history, create a concise title for the conversation that is 15 characters or less.
The title should be brief but descriptive of the message content or intent.
Only return the title itself without any explanation or additional text.
Use the same language that was used in the conversation.

Messages: ${message}
    `.trim();

    const { response } = await azureOpenAIConverse(workerId, ['haiku3.5'], {
      maxTokens: 50,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
        {
          role: 'assistant',
          content: 'Title:',
        },
      ],
    });
    const output = response?.choices?.[0]?.message?.content ?? '';
    let title = output.trim();
    return title;
  } catch (error) {
    console.error('Error generating session title:', error);
    return '';
  }
};

/**
 * Update title for a session
 * @param workerId Worker ID of the session to update
 * @param title The title to set for the session
 */
export const updateSessionTitle = async (workerId: string, title: string): Promise<void> => {
  await updateSession(workerId, { title });
};

type UpdateSessionParams = Partial<Omit<SessionItem, 'PK' | 'SK' | 'createdAt'>>;

/**
 * Generic function to update session fields
 * @param workerId Worker ID of the session to update
 * @param params Object containing the fields to update
 */
export const updateSession = async (workerId: string, params: UpdateSessionParams): Promise<void> => {
  const container = getContainer(CONTAINER_NAME);
  const PK = 'sessions';

  // Get existing item
  const { resource: existing } = await container.item(workerId, PK).read<SessionItem>();

  if (!existing) {
    throw new Error(`[updateSession] Session not found: ${workerId}`);
  }

  // Merge updates
  const updated = {
    ...existing,
    ...params,
    updatedAt: Date.now(),
  };

  // Replace the item
  await container.item(workerId, PK).replace(updated);
};
