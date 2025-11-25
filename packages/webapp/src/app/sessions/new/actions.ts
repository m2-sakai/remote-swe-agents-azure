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
    let workerId = `webapp-${Date.now()}`;
    const { message, imageKeys = [], modelOverride, customAgentId = '' } = parsedInput;
    const now = Date.now();
    const { userId } = ctx;
    const agent = await getCustomAgent(customAgentId);
    const runtimeType = agent?.runtimeType ?? 'ec2';
    if (runtimeType == 'agent-core') {
      // AgentCore Runtime sessionId must have length greater than or equal to 33
      const lacking = 33 - workerId.length;
      if (lacking > 0) {
        workerId = `${workerId}-${randomBytes(~~(lacking / 2)).toString('hex')}`;
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

    // Create session and initial message in a single transaction
    await transactWrite(ContainerName, [
      {
        type: 'Put',
        item: {
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
          initiator: `webapp-${userId}`, // Remove # separator
          customAgentId: agent?.SK,
          runtimeType,
        } satisfies SessionItem,
      },
      {
        type: 'Put',
        item: {
          id: `message-${workerId}-${String(Date.now()).padStart(15, '0')}`, // Remove # separator
          PK: `message-${workerId}`,
          SK: `${String(Date.now()).padStart(15, '0')}`,
          content: JSON.stringify(content),
          role: 'user',
          tokenCount: 0,
          messageType: 'userMessage',
          modelOverride,
        } satisfies MessageItem,
      },
    ]);

    try {
      // Start worker instance for the worker
      await getOrCreateWorkerInstance(workerId, runtimeType);

      // Send worker event to notify message received
      await sendWorkerEvent(workerId, { type: 'onMessageReceived' });
    } catch (e) {
      await updateInstanceStatus(workerId, 'terminated');
      throw e;
    }

    redirect(`/sessions/${workerId}`);
  });
