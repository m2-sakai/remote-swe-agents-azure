import { z } from 'zod';
import { getContainer, ContainerName } from './azure';
import { GlobalPreferences, globalPreferencesSchema, updateGlobalPreferenceSchema } from '../schema';

const CONTAINER_NAME = ContainerName;
const ITEM_ID = 'general';
const PARTITION_KEY = 'global-config';

export const updatePreferences = async (params: z.infer<typeof updateGlobalPreferenceSchema>) => {
  const container = getContainer(CONTAINER_NAME);

  // Get existing preferences
  let existing: any;
  try {
    const { resource } = await container.item(ITEM_ID, PARTITION_KEY).read();
    existing = resource;
  } catch (error: any) {
    if (error.code === 404) {
      // Create default if not exists
      existing = {
        id: ITEM_ID,
        PK: PARTITION_KEY,
        SK: ITEM_ID,
      };
    } else {
      throw error;
    }
  }

  // Merge updates
  const updated = {
    ...existing,
    ...params,
    updatedAt: Date.now(),
  };

  // Upsert the item
  await container.items.upsert(updated);

  return globalPreferencesSchema.parse(updated);
};

export const getPreferences = async (): Promise<GlobalPreferences> => {
  const container = getContainer(CONTAINER_NAME);

  try {
    const { resource } = await container.item(ITEM_ID, PARTITION_KEY).read();
    console.log('[getPreferences] raw resource:', resource);

    if (!resource) {
      console.log('[getPreferences] resource is undefined, returning default');
      return globalPreferencesSchema.parse({
        id: ITEM_ID,
        PK: PARTITION_KEY,
        SK: ITEM_ID,
        modelOverride: 'gpt-4o',
        enableLinkInPr: false,
        updatedAt: 0,
      });
    }

    const parsed = globalPreferencesSchema.parse(resource);
    console.log('[getPreferences] parsed:', parsed);
    return parsed;
  } catch (error: any) {
    console.error('[getPreferences] error:', error);
    if (error.code === 404) {
      console.log('[getPreferences] 404 error, returning default');
      // Return default preferences
      return globalPreferencesSchema.parse({
        id: ITEM_ID,
        PK: PARTITION_KEY,
        SK: ITEM_ID,
        modelOverride: 'gpt-4o',
        enableLinkInPr: false,
        updatedAt: 0,
      });
    }
    throw error;
  }
};
