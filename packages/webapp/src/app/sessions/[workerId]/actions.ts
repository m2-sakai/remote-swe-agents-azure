'use server';

import { fetchTodoListSchema, sendMessageToAgentSchema, updateAgentStatusSchema, sendEventSchema } from './schemas';
import { authActionClient } from '@/lib/safe-action';
import { putItem, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';
import {
  getOrCreateWorkerInstance,
  renderUserMessage,
  getTodoList,
  getSession,
} from '@remote-swe-agents-azure/agent-core/lib';
import { sendWorkerEvent, updateSessionAgentStatus } from '@remote-swe-agents-azure/agent-core/lib';
import { MessageItem } from '@remote-swe-agents-azure/agent-core/schema';

export const sendMessageToAgent = authActionClient
  .inputSchema(sendMessageToAgentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { workerId, message, imageKeys = [], modelOverride } = parsedInput;
    const session = await getSession(workerId);
    if (!session) {
      throw new Error('[sendMessageToAgent] Session not found');
    }

    const content = [];
    content.push({ text: renderUserMessage({ message }) });
    imageKeys.forEach((key) => {
      content.push({
        image: {
          format: 'webp',
          source: {
            blobKey: key,
          },
        },
      });
    });

    const timestamp = String(Date.now()).padStart(15, '0');
    const item: MessageItem = {
      id: `message-${workerId}-${timestamp}`,
      PK: `message-${workerId}`,
      SK: timestamp,
      content: JSON.stringify(content),
      role: 'user',
      tokenCount: 0,
      messageType: 'userMessage',
      modelOverride,
    };

    // Cosmos DBに保存
    await putItem(ContainerName, item);

    await sendWorkerEvent(workerId, { type: 'onMessageReceived' });

    await getOrCreateWorkerInstance(workerId, session.runtimeType ?? 'ec2');

    return { success: true, item };
  });

export const fetchLatestTodoList = authActionClient.inputSchema(fetchTodoListSchema).action(async ({ parsedInput }) => {
  const { workerId } = parsedInput;
  const todoList = await getTodoList(workerId);
  return { todoList };
});

export const updateAgentStatus = authActionClient
  .inputSchema(updateAgentStatusSchema)
  .action(async ({ parsedInput }) => {
    const { workerId, status } = parsedInput;
    await updateSessionAgentStatus(workerId, status);
    return { success: true };
  });

export const sendEventToAgent = authActionClient.inputSchema(sendEventSchema).action(async ({ parsedInput }) => {
  const { workerId, event } = parsedInput;
  await sendWorkerEvent(workerId, event);
  return { success: true };
});
