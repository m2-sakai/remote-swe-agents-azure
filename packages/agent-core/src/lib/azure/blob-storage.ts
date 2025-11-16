/**
 * Azure Blob Storage Client
 * S3 からの移行用ヘルパー関数
 */
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  ContainerClient,
  BlockBlobClient,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

// クライアント初期化（遅延初期化）
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

/**
 * クライアント初期化
 */
function initializeClient() {
  if (!blobServiceClient) {
    // 環境変数から設定を取得（実行時に取得）
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'remote-swe-agents';
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (connectionString) {
      // 接続文字列を使用（開発環境）
      blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    } else if (accountName) {
      // Managed Identity を使用（本番環境推奨）
      const credential = new DefaultAzureCredential();
      const accountUrl = `https://${accountName}.blob.core.windows.net`;
      blobServiceClient = new BlobServiceClient(accountUrl, credential);
    } else {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_CONNECTION_STRING must be set');
    }

    containerClient = blobServiceClient.getContainerClient(containerName);
  }
  return { blobServiceClient, containerClient };
}

/**
 * Blob クライアントを取得
 */
export function getBlobClient(blobName: string): BlockBlobClient {
  const { containerClient } = initializeClient();
  if (!containerClient) {
    throw new Error('Container client not initialized');
  }
  return containerClient.getBlockBlobClient(blobName);
}

/**
 * S3互換のBucket Name
 */
export const BucketName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'remote-swe-agents';

/**
 * ファイルをアップロード（S3 PutObjectCommand 互換）
 */
export async function uploadFile(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<void> {
  const blobClient = getBlobClient(key);
  const options = contentType ? { blobHTTPHeaders: { blobContentType: contentType } } : undefined;

  await blobClient.upload(data, Buffer.byteLength(data), options);
}

/**
 * ファイルをダウンロード（S3 GetObjectCommand 互換）
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const blobClient = getBlobClient(key);
  const downloadResponse = await blobClient.download();

  if (!downloadResponse.readableStreamBody) {
    throw new Error('No data returned from blob storage');
  }

  return streamToBuffer(downloadResponse.readableStreamBody);
}

/**
 * ファイルを削除（S3 DeleteObjectCommand 互換）
 */
export async function deleteFile(key: string): Promise<void> {
  const blobClient = getBlobClient(key);
  await blobClient.deleteIfExists();
}

/**
 * 署名付きURLを生成（S3 getSignedUrl 互換）
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600 // 秒数
): Promise<string> {
  const blobClient = getBlobClient(key);

  // 接続文字列から認証情報を取得してSASトークンを生成
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    // Managed Identity の場合は User Delegation SAS を使用する必要がある
    // 簡易実装のため、接続文字列が必要
    throw new Error('AZURE_STORAGE_CONNECTION_STRING required for generating signed URLs');
  }

  // 接続文字列から account name と account key を抽出
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error('Invalid connection string format');
  }

  const extractedAccountName = accountNameMatch[1];
  const accountKey = accountKeyMatch[1];
  const sharedKeyCredential = new StorageSharedKeyCredential(extractedAccountName, accountKey);

  const startsOn = new Date();
  const expiresOn = new Date(startsOn.valueOf() + expiresIn * 1000);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'remote-swe-agents',
      blobName: key,
      permissions: BlobSASPermissions.parse('r'), // 読み取り専用
      startsOn,
      expiresOn,
    },
    sharedKeyCredential
  ).toString();

  return `${blobClient.url}?${sasToken}`;
}

/**
 * Blobが存在するか確認
 */
export async function exists(key: string): Promise<boolean> {
  const blobClient = getBlobClient(key);
  return await blobClient.exists();
}

/**
 * コンテナ内のBlobをリスト
 */
export async function listKeys(prefix?: string): Promise<string[]> {
  const { containerClient } = initializeClient();
  if (!containerClient) {
    throw new Error('Container client not initialized');
  }
  const blobNames: string[] = [];

  const options = prefix ? { prefix } : undefined;

  for await (const blob of containerClient.listBlobsFlat(options)) {
    blobNames.push(blob.name);
  }

  return blobNames;
}

/**
 * バイト配列を書き込み（S3互換）
 */
export async function writeBytesToKey(key: string, data: Uint8Array): Promise<void> {
  await uploadFile(key, data);
}

/**
 * バイト配列を読み込み（S3互換）
 */
export async function getBytesFromKey(key: string): Promise<Uint8Array> {
  const buffer = await downloadFile(key);
  return new Uint8Array(buffer);
}

/**
 * Stream を Buffer に変換（内部ヘルパー）
 */
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data: Buffer) => {
      chunks.push(data);
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

export default {
  getBlobClient,
  BucketName,
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  exists,
  listKeys,
  writeBytesToKey,
  getBytesFromKey,
};
