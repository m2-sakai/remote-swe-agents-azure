import z from 'zod';
import { webappEventSchema } from '../schema';

/**
 * Azure Web PubSub を使用したイベント送信
 *
 * 環境変数:
 * - AZURE_WEB_PUBSUB_ENDPOINT: Web PubSub のエンドポイントURL
 * - AZURE_WEB_PUBSUB_KEY: アクセスキー (または Managed Identity を使用)
 */
const webPubSubEndpoint = process.env.AZURE_WEB_PUBSUB_ENDPOINT;
const webPubSubKey = process.env.AZURE_WEB_PUBSUB_KEY;

async function sendEvent(channelPath: string, payload: any) {
  if (!webPubSubEndpoint) {
    // Web PubSub が設定されていない場合はスキップ
    return;
  }

  try {
    // Azure Web PubSub REST API を使用してイベントを送信
    const hubName = 'event-bus'; // Hub名
    const endpoint = `${webPubSubEndpoint}/api/hubs/${hubName}/:send`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webPubSubKey && { Authorization: `Bearer ${webPubSubKey}` }),
      },
      body: JSON.stringify({
        channel: channelPath,
        data: payload,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send event to ${channelPath}: ${response.status} ${response.statusText}`);
      return;
    }

    console.log(`Event sent to channel: ${channelPath}`);
  } catch (error) {
    console.error(`Failed to send event to Azure Web PubSub:`, error);
  }
}

export const workerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('onMessageReceived'),
  }),
  z.object({
    type: z.literal('forceStop'),
  }),
  z.object({
    type: z.literal('sessionUpdated'),
  }),
]);

export async function sendWorkerEvent(workerId: string, event: z.infer<typeof workerEventSchema>) {
  return sendEvent(`worker/${workerId}`, event);
}

// Omit does not work below because webappEventSchema is a union type.
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export async function sendWebappEvent(
  workerId: string,
  event: DistributiveOmit<z.infer<typeof webappEventSchema>, 'timestamp' | 'workerId'>
) {
  try {
    await sendEvent(`webapp/worker/${workerId}`, {
      ...event,
      timestamp: Date.now(),
      workerId,
    } satisfies z.infer<typeof webappEventSchema>);
  } catch (e) {
    // webapp event is not critical so we do not throw on error.
    console.log(`failed to send event: ${e}`);
  }
}
