/**
 * Azure SDK まとめエクスポート
 */
export * from './cosmos';
export * from './blob-storage';
export * from './keyvault';

// DynamoDB互換エクスポート（webappの移行を容易にするため）
import * as cosmosModule from './cosmos';
import * as blobModule from './blob-storage';

export const cosmos = cosmosModule;
export const ddb = cosmos; // DynamoDB互換
export const TableName = cosmosModule.TableName;
export const ContainerName = process.env.AZURE_COSMOS_CONTAINER_NAME || 'remote-swe-agents';

// S3互換エクスポート
export const blob = blobModule;
export const s3 = blob; // S3互換
export const BucketName = blobModule.BucketName;

// よく使う関数を直接エクスポート
export const { getItem, putItem, updateItem, deleteItem, queryItems, queryByPartitionKey, transactWrite, batchWrite } =
  cosmosModule;

export const {
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  writeBytesToKey,
  getBytesFromKey,
  exists: blobExists,
  listBlobs,
} = blobModule;
