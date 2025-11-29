import z from 'zod';
import { DefaultAzureCredential } from '@azure/identity';
import { webappEventSchema } from '../schema';

/**
 * Azure Web PubSub を使用したイベント送信
 *
 * 環境変数:
 * - AZURE_WEB_PUBSUB_ENDPOINT: Web PubSub のエンドポイントURL
 * - マネージドIDを使用して認証
 */
const webPubSubEndpoint = process.env.AZURE_WEB_PUBSUB_ENDPOINT;
const credential = new DefaultAzureCredential();

async function getAccessToken(): Promise<string | null> {
  try {
    console.log('[agent-core/events] Requesting MSI token for WebPubSub scope');
    const tokenResponse = await credential.getToken('https://webpubsub.azure.com/.default');
    console.log('[agent-core/events] Token acquired', {
      hasToken: !!tokenResponse?.token,
      expiresOnTimestamp: tokenResponse?.expiresOnTimestamp,
    });
    return tokenResponse.token;
  } catch (error) {
    const err = error as any;
    console.error('[agent-core/events] Failed to get access token', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return null;
  }
}

async function sendEvent(channelPath: string, payload: any) {
  if (!webPubSubEndpoint) {
    // Web PubSub が設定されていない場合はスキップ
    console.warn('[agent-core/events] Skipping sendEvent: AZURE_WEB_PUBSUB_ENDPOINT not set');
    return;
  }

  try {
    // マネージドIDでトークンを取得
    const token = await getAccessToken();
    if (!token) {
      console.error('[agent-core/events] No token, aborting send');
      return;
    }

    // Azure Web PubSub REST API を使用してイベントを送信
    const hubName = 'remoteswehub'; // Hub名
    const endpoint = `${webPubSubEndpoint}/api/hubs/${hubName}/:send`;
    console.log('[agent-core/events] Sending event', {
      endpoint,
      channelPath,
      payloadType: typeof payload,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channelPath,
        data: payload,
      }),
    });

    if (!response.ok) {
      let bodyText: string | undefined;
      try {
        bodyText = await response.text();
      } catch {
        bodyText = undefined;
      }
      console.error('[agent-core/events] Send failed', {
        channelPath,
        status: response.status,
        statusText: response.statusText,
        body: bodyText,
      });
      return;
    }

    console.log('[agent-core/events] Event sent', { channelPath });
  } catch (error) {
    const err = error as any;
    console.error('[agent-core/events] Exception during send', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
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
