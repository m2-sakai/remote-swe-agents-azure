/**
 * Azure Web PubSub を使用したリアルタイムイベント送信
 *
 * 環境変数:
 * - AZURE_WEB_PUBSUB_ENDPOINT: Web PubSub のエンドポイントURL
 * - AZURE_WEB_PUBSUB_KEY: アクセスキー (または Managed Identity を使用)
 *
 * TODO: 本格的な実装が必要な場合は @azure/web-pubsub SDK を使用
 */
const webPubSubEndpoint = process.env.AZURE_WEB_PUBSUB_ENDPOINT;
const webPubSubKey = process.env.AZURE_WEB_PUBSUB_KEY;

export async function sendEvent(channelName: string, payload: unknown) {
  if (!webPubSubEndpoint) {
    console.warn('AZURE_WEB_PUBSUB_ENDPOINT is not configured. Event will not be sent.');
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
        channel: channelName,
        data: payload,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send event: ${response.status} ${response.statusText}`);
      return;
    }

    console.log(`Event sent to channel: ${channelName}`);
  } catch (error) {
    console.error('Failed to send event to Azure Web PubSub:', error);
  }
}
