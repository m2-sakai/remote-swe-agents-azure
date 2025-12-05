/**
 * Azure Web PubSub を使用したリアルタイムイベント受信
 */
import { useEffect, useRef, useState } from 'react';
import { WebPubSubClient } from '@azure/web-pubsub-client';

type useWebPubSubProps = {
  channelName: string;
  onReceived: (payload: unknown) => void;
};

export const useWebPubSub = ({ channelName, onReceived }: useWebPubSubProps) => {
  const clientRef = useRef<WebPubSubClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isActive = true;

    const connect = async () => {
      try {
        // Extract workerId from channelName (format: webapp/worker/{workerId})
        const workerId = channelName.split('/').pop();
        if (!workerId) {
          console.error('[useWebPubSub] Invalid channelName format:', channelName);
          return;
        }

        // Fetch client access token from API
        const tokenUrl = `/api/pubsub?workerId=${workerId}`;
        const response = await fetch(tokenUrl);
        if (!response.ok) {
          console.error('[useWebPubSub] Failed to fetch token:', {
            status: response.status,
            statusText: response.statusText,
          });
          return;
        }
        const json = await response.json();
        const { url, baseUrl, channelName: serverChannelName } = json;

        // Create WebPubSub client
        const client = new WebPubSubClient(url);
        clientRef.current = client;

        // Event handlers
        client.on('connected', () => {
          setIsConnected(true);
        });

        client.on('disconnected', () => {
          setIsConnected(false);
        });

        client.on('group-message', (e) => {
          if (e.message.group === channelName) {
            try {
              const payload = typeof e.message.data === 'string' ? JSON.parse(e.message.data) : e.message.data;
              onReceived(payload);
            } catch (error) {
              console.error('[useWebPubSub] Failed to parse message:', error);
            }
          }
        });

        // Start connection
        await client.start();

        // Join group
        await client.joinGroup(channelName);
      } catch (error) {
        const err = error as any;
        console.error('[useWebPubSub] Connection error:', {
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
        });
      }
    };

    if (isActive) {
      connect();
    }

    return () => {
      isActive = false;
      const client = clientRef.current;
      if (client) {
        client
          .leaveGroup(channelName)
          .catch((err: unknown) => console.error('[useWebPubSub] Failed to leave group:', err))
          .finally(() => {
            client.stop();
          });
      }
    };
  }, [channelName, onReceived]);

  return { isConnected };
};
