import { getContainer } from './azure/cosmos';
import { ApiKeyItem } from '../schema';
import crypto from 'crypto';

const CONTAINER_NAME = 'api-keys';

/**
 * Create a new API key
 * @param description Optional description for the key
 * @param ownerId Optional owner ID
 * @returns The generated API key
 */
export const createApiKey = async (description?: string, ownerId?: string): Promise<string> => {
  const now = Date.now();
  const timestamp = String(now).padStart(15, '0');

  // Generate a random 32 byte key and hex encode it
  const apiKey = crypto.randomBytes(32).toString('hex');

  const container = getContainer(CONTAINER_NAME);
  await container.items.create({
    id: apiKey,
    PK: 'api-key',
    SK: apiKey,
    LSI1: timestamp,
    createdAt: now,
    description,
    ownerId,
  } satisfies ApiKeyItem & { id: string });

  return apiKey;
};

/**
 * Validate if an API key exists
 * @param apiKey The API key to validate
 * @returns true if the key exists, false otherwise
 */
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const container = getContainer(CONTAINER_NAME);
    const { resource } = await container.item(apiKey, 'api-key').read();
    return !!resource;
  } catch (error: any) {
    if (error.code === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * Get all API keys
 * @param limit Maximum number of keys to return
 * @returns Array of API key items
 */
export const getApiKeys = async (limit: number = 50): Promise<ApiKeyItem[]> => {
  const container = getContainer(CONTAINER_NAME);

  const querySpec = {
    query: 'SELECT * FROM c WHERE c.PK = @pk ORDER BY c.LSI1 DESC',
    parameters: [{ name: '@pk', value: 'api-key' }],
  };

  const { resources } = await container.items.query<ApiKeyItem>(querySpec, { maxItemCount: limit }).fetchAll();

  return resources;
};

/**
 * Delete an API key
 * @param apiKey The API key to delete
 */
export const deleteApiKey = async (apiKey: string): Promise<void> => {
  const container = getContainer(CONTAINER_NAME);
  await container.item(apiKey, 'api-key').delete();
};
