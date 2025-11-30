import { validateApiKeyMiddleware } from '../auth/api-key';
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateWorkerInstance, sendWorkerEvent } from '@remote-swe-agents-azure/agent-core/lib';
import { transactWrite, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';
import { z } from 'zod';
import { MessageItem, modelTypeSchema, SessionItem } from '@remote-swe-agents-azure/agent-core/schema';

// Schema for request validation
const createSessionSchema = z.object({
  message: z.string().min(1),
  modelOverride: modelTypeSchema.optional(),
});

export async function POST(request: NextRequest) {
  // Validate API key
  const apiKeyValidation = await validateApiKeyMiddleware(request);
  if (apiKeyValidation) {
    return apiKeyValidation;
  }

  // Parse and validate request body
  const body = await request.json();
  const parsedBody = createSessionSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid request data', details: parsedBody.error.format() }, { status: 400 });
  }

  const { message, modelOverride } = parsedBody.data;
  const workerId = `api-${Date.now()}`;
  const now = Date.now();

  // Create content for the message
  const content = [{ text: message }];

  // Create session and initial message in a transaction
  const messageTimestamp = String(Date.now()).padStart(15, '0');
  await transactWrite(ContainerName, [
    {
      type: 'Put',
      item: {
        id: `sessions-${workerId}`,
        PK: 'sessions',
        SK: workerId,
        workerId,
        initialMessage: message,
        createdAt: now,
        updatedAt: now,
        LSI1: String(now).padStart(15, '0'),
        instanceStatus: 'starting',
        agentStatus: 'pending',
        sessionCost: 0,
        initiator: `rest`,
      } satisfies SessionItem,
    },
    {
      type: 'Put',
      item: {
        id: `message-${workerId}-${messageTimestamp}`,
        PK: `message-${workerId}`,
        SK: messageTimestamp,
        content: JSON.stringify(content),
        role: 'user',
        tokenCount: 0,
        messageType: 'userMessage',
        modelOverride,
      } satisfies MessageItem,
    },
  ]);

  // Start EC2 instance for the worker
  await getOrCreateWorkerInstance(workerId);

  // Send worker event to notify message received
  await sendWorkerEvent(workerId, { type: 'onMessageReceived' });

  return NextResponse.json({ sessionId: workerId }, { status: 201 });
}
