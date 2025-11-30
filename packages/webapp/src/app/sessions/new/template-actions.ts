'use server';

import { z } from 'zod';
import { authActionClient } from '@/lib/safe-action';
import { putItem, updateItem, deleteItem, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';
import { revalidatePath } from 'next/cache';
import { PromptTemplate } from './schemas';

const createTemplateSchema = z.object({
  content: z.string().min(1, 'Template content is required'),
});

const updateTemplateSchema = z.object({
  id: z.string(),
  content: z.string().min(1, 'Template content is required'),
});

const deleteTemplateSchema = z.object({
  id: z.string(),
});

export const createPromptTemplate = authActionClient.schema(createTemplateSchema).action(async ({ parsedInput }) => {
  const { content } = parsedInput;
  const now = Date.now();
  const id = now.toString();

  await putItem(ContainerName, {
    id: `prompt-template-${id}`,
    PK: 'prompt-template',
    SK: id,
    content,
    createdAt: now,
  } satisfies PromptTemplate & { id: string; PK: string });

  revalidatePath('/sessions/new');
  return { success: true };
});

export const updatePromptTemplate = authActionClient.schema(updateTemplateSchema).action(async ({ parsedInput }) => {
  const { id, content } = parsedInput;

  await updateItem(ContainerName, `prompt-template-${id}`, 'prompt-template', { content });

  revalidatePath('/sessions/new');
  return { success: true };
});

export const deletePromptTemplate = authActionClient.schema(deleteTemplateSchema).action(async ({ parsedInput }) => {
  const { id } = parsedInput;

  await deleteItem(ContainerName, `prompt-template-${id}`, 'prompt-template');

  revalidatePath('/sessions/new');
  return { success: true };
});
