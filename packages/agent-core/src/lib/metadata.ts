import { getContainer, ContainerName } from './azure';

const CONTAINER_NAME = ContainerName;

/**
 * Write metadata to Cosmos DB.
 * @param tag The tag to use as the SK in Cosmos DB
 * @param data The object data to store
 * @param workerId The worker ID to use as part of the PK
 */
export const writeMetadata = async (tag: string, data: object, workerId: string = process.env.WORKER_ID!) => {
  const container = getContainer(CONTAINER_NAME);
  const PK = `metadata-${workerId}`;
  const id = `${PK}#${tag}`;

  await container.items.upsert({
    id,
    PK,
    SK: tag,
    ...data,
  });
};

/**
 * Read metadata from Cosmos DB.
 * @param tag The tag to use as the SK in Cosmos DB
 * @param workerId The worker ID to use as part of the PK
 * @returns The metadata object or null if not found
 */
export const readMetadata = async (tag: string, workerId: string = process.env.WORKER_ID!) => {
  const container = getContainer(CONTAINER_NAME);
  const PK = `metadata-${workerId}`;
  const id = `${PK}#${tag}`;

  try {
    const { resource: item } = await container.item(id, PK).read();
    return item;
  } catch (error: any) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
};
