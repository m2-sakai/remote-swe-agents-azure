'use server';

import { authActionClient } from '@/lib/safe-action';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';
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

const getImageUrlsSchema = z.object({
  keys: z.array(z.string()),
});

export const getImageUrls = authActionClient.inputSchema(getImageUrlsSchema).action(async ({ parsedInput }) => {
  const { keys } = parsedInput;

  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const results = (
    await Promise.all(
      keys.map(async (key) => {
        try {
          const blobClient = containerClient.getBlobClient(key);

          // Check if blob exists
          const exists = await blobClient.exists();
          if (!exists) {
            return undefined;
          }

          // Generate SAS token for read access
          const sasToken = generateBlobSASQueryParameters(
            {
              containerName,
              blobName: key,
              permissions: BlobSASPermissions.parse('r'), // Read only
              startsOn: new Date(),
              expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
            },
            new StorageSharedKeyCredential(accountName!, accountKey!)
          ).toString();

          const signedUrl = `${blobClient.url}?${sasToken}`;

          return {
            url: signedUrl,
            key,
          };
        } catch (error) {
          console.error(`Failed to get signed URL for blob: ${key}`, error);
          return undefined;
        }
      })
    )
  ).filter((r) => r != null);

  return results;
});
