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
        const response = await fetch(`/api/pubsub?workerId=${workerId}`);
        if (!response.ok) {
          console.error('[useWebPubSub] Failed to fetch token:', response.statusText);
          return;
        }

        const { url } = await response.json();

        // Create WebPubSub client
        const client = new WebPubSubClient(url);
        clientRef.current = client;

        // Event handlers
        client.on('connected', () => {
          console.log('[useWebPubSub] Connected to WebPubSub');
          setIsConnected(true);
        });

        client.on('disconnected', () => {
          console.log('[useWebPubSub] Disconnected from WebPubSub');
          setIsConnected(false);
        });

        client.on('group-message', (e) => {
          if (e.message.group === channelName) {
            console.log('[useWebPubSub] Received message:', e.message.data);
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
        console.log('[useWebPubSub] Joined group:', channelName);
      } catch (error) {
        console.error('[useWebPubSub] Connection error:', error);
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
