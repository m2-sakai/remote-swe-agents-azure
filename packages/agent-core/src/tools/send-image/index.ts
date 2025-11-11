import { z } from 'zod';
import { ToolDefinition, zodToJsonSchemaBody } from '../../private/common/lib';
import { uploadFile } from '../../lib/azure/blob-storage';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { getAttachedImageKey } from '../../lib';

const inputSchema = z.object({
  imagePath: z.string().describe('the local file system path to the image'),
  message: z.string().describe('message to send along with the image to user'),
});

const name = 'sendImageToUser';

const getContentTypeFromExtension = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
};

export const sendImageTool: ToolDefinition<z.infer<typeof inputSchema>> = {
  name,
  handler: async (input: z.infer<typeof inputSchema>, context) => {
    const fileBuffer = readFileSync(input.imagePath);
    const contentType = getContentTypeFromExtension(input.imagePath);
    const blobKey = getAttachedImageKey(context.workerId, context.toolUseId, input.imagePath);

    await uploadFile(blobKey, fileBuffer, contentType);

    return 'successfully sent an image with message.';
  },
  schema: inputSchema,
  toolSpec: async () => ({
    name,
    description: `Send an image with a message to the user. This tool will upload an image from a local file path and send it to the user through WebUI with an accompanying message.`,
    inputSchema: {
      json: zodToJsonSchemaBody(inputSchema),
    },
  }),
};
