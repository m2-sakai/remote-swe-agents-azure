'use server';

import { authActionClient } from '@/lib/safe-action';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'images';

function getBlobServiceClient() {
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  } else if (accountName && accountKey) {
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    return new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
  }
  throw new Error('Azure Storage configuration is missing');
}

const getUploadUrlSchema = z.object({
  workerId: z.string().optional(),
  contentType: z.string(),
});

export const getUploadUrl = authActionClient.inputSchema(getUploadUrlSchema).action(async ({ parsedInput }) => {
  const { workerId, contentType } = parsedInput;

  if (!['image/png', 'image/webp', 'image/jpeg'].includes(contentType)) {
    throw new Error('Invalid content type');
  }

  const extension = contentType.split('/')[1];
  const randomId = randomBytes(8).toString('hex');

  // If workerId is provided, use it in the path, otherwise use webapp_init prefix
  const key = workerId ? `${workerId}/${randomId}.${extension}` : `webapp_init/${randomId}.${extension}`;

  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(key);

  // Generate SAS token for write access
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName: key,
      permissions: BlobSASPermissions.parse('w'), // Write only
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 60 * 1000), // 60 seconds
    },
    new StorageSharedKeyCredential(accountName!, accountKey!)
  ).toString();

  const signedUrl = `${blobClient.url}?${sasToken}`;

  return {
    url: signedUrl,
    key,
  };
});
