/**
 * Azure Cosmos DB Client
 * DynamoDB からの移行用ヘルパー関数
 */
import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// クライアント初期化（遅延初期化）
let cosmosClient: CosmosClient | null = null;
let database: Database | null = null;

function initializeClient() {
  if (!cosmosClient) {
    // 環境変数から設定を取得（実行時に取得）
    const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
    const databaseId = process.env.AZURE_COSMOS_DATABASE_ID || 'remote-swe-agents';
    const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;

    if (connectionString) {
      // 接続文字列が提供されている場合（開発環境）
      cosmosClient = new CosmosClient(connectionString);
    } else if (endpoint) {
      // Managed Identity を使用（本番環境推奨）
      const credential = new DefaultAzureCredential();
      cosmosClient = new CosmosClient({ endpoint, aadCredentials: credential });
    } else {
      throw new Error('AZURE_COSMOS_ENDPOINT or AZURE_COSMOS_CONNECTION_STRING must be set');
    }

    database = cosmosClient.database(databaseId);
  }
  return { cosmosClient, database };
}

/**
 * コンテナを取得
 */
export function getContainer(containerName: string): Container {
  const { database } = initializeClient();
  if (!database) {
    throw new Error('Database not initialized');
  }
  return database.container(containerName);
}

/**
 * DynamoDB互換のTable Name（現在は使用しませんが、移行の互換性のため保持）
 */
export const TableName = process.env.AZURE_COSMOS_DATABASE_ID || 'remote-swe-agents';

/**
 * アイテムを取得（DynamoDB GetCommand 互換）
 */
export async function getItem<T = any>(
  containerName: string,
  id: string,
  partitionKey: string
): Promise<T | undefined> {
  try {
    const container = getContainer(containerName);
    const { resource } = await container.item(id, partitionKey).read();
    return resource as T;
  } catch (error: any) {
    if (error.code === 404) {
      return undefined;
    }
    throw error;
  }
}

/**
 * アイテムを作成/更新（DynamoDB PutCommand 互換）
 */
export async function putItem<T>(containerName: string, item: T & { id: string; PK: string }): Promise<void> {
  const container = getContainer(containerName);
  await container.items.upsert(item);
}

/**
 * アイテムを更新（DynamoDB UpdateCommand 互換）
 */
export async function updateItem<T>(
  containerName: string,
  id: string,
  partitionKey: string,
  updates: Partial<T>
): Promise<void> {
  const container = getContainer(containerName);
  const { resource: existing } = await container.item(id, partitionKey).read();

  if (!existing) {
    throw new Error(`Item not found: ${id}`);
  }

  const updated = { ...existing, ...updates };
  await container.item(id, partitionKey).replace(updated);
}

/**
 * アイテムを削除（DynamoDB DeleteCommand 互換）
 */
export async function deleteItem(containerName: string, id: string, partitionKey: string): Promise<void> {
  const container = getContainer(containerName);
  await container.item(id, partitionKey).delete();
}

/**
 * クエリ実行（DynamoDB QueryCommand 互換）
 */
export async function queryItems<T = any>(
  containerName: string,
  query: string,
  parameters?: { name: string; value: any }[]
): Promise<T[]> {
  const container = getContainer(containerName);
  const querySpec = {
    query,
    parameters,
  };
  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources as T[];
}

/**
 * パーティションキーでクエリ（簡易版）
 */
export async function queryByPartitionKey<T = any>(
  containerName: string,
  partitionKey: string,
  limit?: number
): Promise<T[]> {
  const container = getContainer(containerName);
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.PK = @pk',
    parameters: [{ name: '@pk', value: partitionKey }],
  };

  const feedOptions = limit ? { maxItemCount: limit } : undefined;
  const { resources } = await container.items.query(querySpec, feedOptions).fetchAll();

  return resources as T[];
}

/**
 * トランザクション書き込み（DynamoDB TransactWriteCommand 互換）
 * Cosmos DB では Batch Operations を使用
 */
export async function transactWrite(
  containerName: string,
  operations: Array<{
    type: 'Put' | 'Update' | 'Delete';
    item?: any;
    id?: string;
    partitionKey?: string;
    updates?: any;
  }>
): Promise<void> {
  const container = getContainer(containerName);

  // Cosmos DB のバッチ操作は同じパーティションキー内でのみ可能
  // 複数パーティションにまたがる場合は個別に実行
  for (const op of operations) {
    if (op.type === 'Put' && op.item) {
      await container.items.upsert(op.item);
    } else if (op.type === 'Update' && op.id && op.partitionKey && op.updates) {
      const { resource: existing } = await container.item(op.id, op.partitionKey).read();
      if (existing) {
        const updated = { ...existing, ...op.updates };
        await container.item(op.id, op.partitionKey).replace(updated);
      }
    } else if (op.type === 'Delete' && op.id && op.partitionKey) {
      await container.item(op.id, op.partitionKey).delete();
    }
  }
}

/**
 * バッチ書き込み（複数アイテムを一度に書き込み）
 */
export async function batchWrite(containerName: string, items: Array<any>): Promise<void> {
  const container = getContainer(containerName);

  // 並列実行で高速化
  await Promise.all(items.map((item) => container.items.upsert(item)));
}

export default {
  getContainer,
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  queryByPartitionKey,
  transactWrite,
  batchWrite,
  TableName,
};
