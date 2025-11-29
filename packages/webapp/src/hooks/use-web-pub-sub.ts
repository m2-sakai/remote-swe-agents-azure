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
        console.log('[useWebPubSub] Starting connect flow', {
          channelName,
          time: new Date().toISOString(),
        });
        // Extract workerId from channelName (format: webapp/worker/{workerId})
        const workerId = channelName.split('/').pop();
        if (!workerId) {
          console.error('[useWebPubSub] Invalid channelName format:', channelName);
          return;
        }

        // Fetch client access token from API
        const tokenUrl = `/api/pubsub?workerId=${workerId}`;
        console.log('[useWebPubSub] Fetching token', { tokenUrl });
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
        console.log('[useWebPubSub] Token response received', {
          baseUrl,
          urlHost: (() => {
            try {
              return new URL(url).hostname;
            } catch {
              return 'n/a';
            }
          })(),
          serverChannelName,
        });

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
            console.log('[useWebPubSub] Received message', {
              group: e.message.group,
              dataType: typeof e.message.data,
              hasBinary: !!(e as any).data?.binaryData,
            });
            try {
              const payload = typeof e.message.data === 'string' ? JSON.parse(e.message.data) : e.message.data;
              console.log('[useWebPubSub] Parsed payload', { type: payload?.type });
              onReceived(payload);
            } catch (error) {
              console.error('[useWebPubSub] Failed to parse message:', error);
            }
          }
        });

        // Start connection
        console.log('[useWebPubSub] Starting client connection...');
        await client.start();
        console.log('[useWebPubSub] Client start resolved');

        // Join group
        console.log('[useWebPubSub] Joining group...', { channelName });
        await client.joinGroup(channelName);
        console.log('[useWebPubSub] Joined group:', channelName);
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
        console.log('[useWebPubSub] Cleaning up connection', { channelName });
        client
          .leaveGroup(channelName)
          .catch((err: unknown) => console.error('[useWebPubSub] Failed to leave group:', err))
          .finally(() => {
            client.stop();
            console.log('[useWebPubSub] Client stopped');
          });
      }
    };
  }, [channelName, onReceived]);

  return { isConnected };
};
