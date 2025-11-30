'use server';

import { createNewWorkerSchema } from './schemas';
import { authActionClient } from '@/lib/safe-action';
import { transactWrite, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';
import {
  getCustomAgent,
  getOrCreateWorkerInstance,
  renderUserMessage,
  updateInstanceStatus,
} from '@remote-swe-agents-azure/agent-core/lib';
import { sendWorkerEvent } from '@remote-swe-agents-azure/agent-core/lib';
import { MessageItem, SessionItem } from '@remote-swe-agents-azure/agent-core/schema';
import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';

export const createNewWorker = authActionClient
  .inputSchema(createNewWorkerSchema)
  .action(async ({ parsedInput, ctx }) => {
    console.log('[createNewWorker] START - Input:', JSON.stringify(parsedInput, null, 2));
    console.log('[createNewWorker] Context userId:', ctx.userId);

    let workerId = `webapp-${Date.now()}`;
    const { message, imageKeys = [], modelOverride, customAgentId = '' } = parsedInput;
    const now = Date.now();
    const { userId } = ctx;

    console.log('[createNewWorker] Generated workerId:', workerId);

    const agent = await getCustomAgent(customAgentId);
    console.log('[createNewWorker] Custom agent:', agent ? `Found: ${agent.name}` : 'Not found, using default');

    const runtimeType = agent?.runtimeType ?? 'vm'; // Default to VM runtime
    console.log('[createNewWorker] Runtime type:', runtimeType);

    if (runtimeType === 'agent-core') {
      // AgentCore Runtime sessionId must have length greater than or equal to 33
      const lacking = 33 - workerId.length;
      if (lacking > 0) {
        workerId = `${workerId}-${randomBytes(~~(lacking / 2)).toString('hex')}`;
        console.log('[createNewWorker] Extended workerId for agent-core:', workerId);
      }
    }

    const content = [];
    content.push({ text: renderUserMessage({ message }) });

    // Add image keys if present
    if (imageKeys && imageKeys.length > 0) {
      for (const key of imageKeys) {
        content.push({
          image: {
            format: 'webp',
            source: {
              blobKey: key, // Changed from s3Key to blobKey
            },
          },
        });
      }
    }

    const sessionItem = {
      // Session record
      id: workerId, // Cosmos DB document ID (no special characters)
      PK: 'sessions',
      SK: workerId,
      workerId,
      initialMessage: message,
      createdAt: now,
      updatedAt: now,
      LSI1: String(now).padStart(15, '0'),
      instanceStatus: 'starting',
      sessionCost: 0,
      agentStatus: 'pending',
      initiator: `webapp-${userId}`,
      customAgentId: customAgentId !== 'DEFAULT' ? customAgentId : undefined, // Use original customAgentId (SK), not agent?.SK
      runtimeType,
    } satisfies SessionItem;

    const messageItem = {
      id: `message-${workerId}-${String(Date.now()).padStart(15, '0')}`,
      PK: `message-${workerId}`,
      SK: `${String(Date.now()).padStart(15, '0')}`,
      content: JSON.stringify(content),
      role: 'user',
      tokenCount: 0,
      messageType: 'userMessage',
      modelOverride,
    } satisfies MessageItem;

    console.log('[createNewWorker] Session item:', JSON.stringify(sessionItem, null, 2));
    console.log('[createNewWorker] Message item:', JSON.stringify(messageItem, null, 2));

    // Create session and initial message in a single transaction
    console.log('[createNewWorker] Calling transactWrite...');
    try {
      await transactWrite(ContainerName, [
        {
          type: 'Put',
          item: sessionItem,
        },
        {
          type: 'Put',
          item: messageItem,
        },
      ]);
      console.log('[createNewWorker] transactWrite completed successfully');
    } catch (error) {
      console.error('[createNewWorker] transactWrite failed:', error);
      throw error;
    }

    try {
      console.log('[createNewWorker] Starting worker instance...');
      // Start worker instance for the worker
      await getOrCreateWorkerInstance(workerId, runtimeType);
      console.log('[createNewWorker] Worker instance started');

      console.log('[createNewWorker] Sending worker event...');
      // Send worker event to notify message received
      await sendWorkerEvent(workerId, { type: 'onMessageReceived' });
      console.log('[createNewWorker] Worker event sent');
    } catch (e) {
      console.error('[createNewWorker] Worker startup failed:', e);
      await updateInstanceStatus(workerId, 'terminated');
      throw e;
    }

    console.log('[createNewWorker] Redirecting to session:', workerId);
    redirect(`/sessions/${workerId}`);
  });
