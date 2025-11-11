/**
 * Azure Web PubSub を使用したリアルタイムイベント受信
 *
 * TODO: Azure Web PubSub または SignalR の実装が必要
 * 現在は一時的に無効化しています
 *
 * 実装方法:
 * 1. @azure/web-pubsub-client をインストール
 * 2. WebSocket接続を確立
 * 3. チャンネルをsubscribe
 *
 * 参考: https://learn.microsoft.com/ja-jp/azure/azure-web-pubsub/
 */
import { useEffect } from 'react';

type UseEventBusProps = {
  channelName: string;
  onReceived: (payload: unknown) => void;
};

export const useEventBus = ({ channelName, onReceived }: UseEventBusProps) => {
  useEffect(() => {
    console.warn(`useEventBus: Azure Web PubSub is not yet implemented for channel "${channelName}"`);

    // TODO: Azure Web PubSub の実装
    // 例:
    // const webPubSubClient = new WebPubSubClient({
    //   endpoint: process.env.NEXT_PUBLIC_AZURE_WEB_PUBSUB_ENDPOINT,
    //   hub: 'event-bus',
    // });
    //
    // await webPubSubClient.start();
    // webPubSubClient.on('message', (message) => {
    //   if (message.group === channelName) {
    //     onReceived(message.data);
    //   }
    // });
    //
    // return () => {
    //   webPubSubClient.stop();
    // };

    return () => {
      // Cleanup
    };
  }, [channelName, onReceived]);
};
