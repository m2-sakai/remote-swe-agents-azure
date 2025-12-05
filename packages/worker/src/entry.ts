import { onMessageReceived, resume } from './agent';
import './common/signal-handler';
import { setKillTimer, pauseKillTimer, restartKillTimer } from './common/kill-timer';
import { CancellationToken } from './common/cancellation-token';
import { sendSystemMessage, updateInstanceStatus, workerEventSchema } from '@remote-swe-agents-azure/agent-core/lib';
import { updateAgentStatusWithEvent } from './common/status';
import { refreshSession } from './common/refresh-session';
import { WebPubSubClient } from '@azure/web-pubsub-client';
import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { DefaultAzureCredential } from '@azure/identity';

Object.assign(global, { WebSocket: require('ws') });

const webPubSubEndpoint = process.env.AZURE_WEB_PUBSUB_ENDPOINT;
const webPubSubHub = 'remoteswehub';
const credential = new DefaultAzureCredential();

class ConverseSessionTracker {
  private sessions: { isFinished: boolean; cancellationToken: CancellationToken }[] = [];
  public constructor(private readonly workerId: string) {}

  public startOnMessageReceived() {
    const session = { isFinished: false, cancellationToken: new CancellationToken() };
    this.sessions.push(session);
    // temporarily pause kill timer when an agent loop is running
    const restartToken = pauseKillTimer();
    onMessageReceived(this.workerId, session.cancellationToken)
      .then(() => {
        session.isFinished = true;
      })
      .catch((e) => {
        sendSystemMessage(this.workerId, `An error occurred: ${e}`).catch(console.error);
        console.error(e);
      })
      .finally(() => {
        restartKillTimer(this.workerId, restartToken);
      });
  }

  public startResume() {
    const session = { isFinished: false, cancellationToken: new CancellationToken() };
    this.sessions.push(session);
    const restartToken = pauseKillTimer();
    resume(this.workerId, session.cancellationToken)
      .then(() => {
        session.isFinished = true;
      })
      .catch((e) => {
        sendSystemMessage(this.workerId, `An error occurred: ${e}`).catch(console.error);
        console.error(e);
      })
      .finally(() => {
        restartKillTimer(this.workerId, restartToken);
      });
  }

  /**
   *
   * @param callback The callback function that is executed when each session is cancelled.
   */
  public cancelCurrentSessions(callback?: () => Promise<any>) {
    // cancel unfinished sessions
    for (const task of this.sessions) {
      if (task.isFinished) continue;
      task.cancellationToken.cancel(callback);
    }
    // remove finished sessions
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      if (this.sessions[i]!.isFinished) {
        this.sessions.splice(i, 1);
      }
    }
  }

  /**
   * return true if there is ongoing session.
   */
  public isBusy() {
    return this.sessions.some((session) => !session.isFinished);
  }
}

const isStarted: { [key: string]: boolean } = {};
export const main = async (workerId: string) => {
  if (isStarted[workerId]) {
    console.warn(`The worker ${workerId} is already started.`);
    return;
  }

  isStarted[workerId] = true;
  const tracker = new ConverseSessionTracker(workerId);

  // Azure Web PubSub を使用したリアルタイムイベント購読
  let webPubSubClient: WebPubSubClient | null = null;

  if (webPubSubEndpoint) {
    try {
      // マネージドIDでトークンを取得
      const tokenResponse = await credential.getToken('https://webpubsub.azure.com/.default');

      // Web PubSubサービスクライアントを使用してクライアントアクセスURLを生成
      const serviceClient = new WebPubSubServiceClient(webPubSubEndpoint, credential, webPubSubHub);
      const clientAccessUrl = await serviceClient.getClientAccessToken({
        userId: workerId,
        roles: [`webpubsub.joinLeaveGroup.worker/${workerId}`, 'webpubsub.sendToGroup'],
      });

      // Web PubSubクライアントを初期化
      webPubSubClient = new WebPubSubClient(clientAccessUrl.url);

      // ブロードキャストメッセージを受信
      webPubSubClient.on('server-message', (e: any) => {
        const messageChannel = e.message.data?.channel;
        const expectedChannel = `worker/${workerId}`;

        if (messageChannel === expectedChannel) {
          try {
            const { data: event, error, success } = workerEventSchema.safeParse(e.message.data.data);
            if (!success || error) {
              console.error('[worker/entry] Invalid worker event schema in broadcast', { error });
              return;
            }

            const type = event.type;
            if (type === 'onMessageReceived') {
              tracker.cancelCurrentSessions();
              tracker.startOnMessageReceived();
            } else if (type === 'forceStop') {
              tracker.cancelCurrentSessions(async () => {
                await updateAgentStatusWithEvent(workerId, 'pending');
                await sendSystemMessage(workerId, 'Agent work was stopped.');
              });
            } else if (type === 'sessionUpdated') {
              refreshSession(workerId).catch((err) => console.error('Error refreshing session:', err));
            }
          } catch (error) {
            console.error('[worker/entry] Error processing broadcast message:', error);
          }
        }
      });

      // グループメッセージを受信（特定のworker向け）
      webPubSubClient.on('group-message', (e: any) => {
        try {
          const { data: event, error, success } = workerEventSchema.safeParse(e.message.data);
          if (!success || error) {
            console.error('[worker/entry] Invalid worker event schema', { error });
            return;
          }

          const type = event.type;
          if (type === 'onMessageReceived') {
            tracker.cancelCurrentSessions();
            tracker.startOnMessageReceived();
          } else if (type === 'forceStop') {
            tracker.cancelCurrentSessions(async () => {
              await updateAgentStatusWithEvent(workerId, 'pending');
              await sendSystemMessage(workerId, 'Agent work was stopped.');
            });
          } else if (type === 'sessionUpdated') {
            refreshSession(workerId).catch((err) => console.error('Error refreshing session:', err));
          }
        } catch (error) {
          console.error('[worker/entry] Error processing group message:', error);
        }
      });

      // 接続
      await webPubSubClient.start();
      await webPubSubClient.joinGroup(`worker/${workerId}`);

      // プロセス終了時に接続を閉じる
      const cleanup = async () => {
        if (webPubSubClient) {
          await webPubSubClient.stop();
        }
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    } catch (error) {
      console.error('Failed to initialize Web PubSub client:', error);
    }
  } else {
    console.warn('AZURE_WEB_PUBSUB_ENDPOINT not set. Real-time events disabled.');
  }

  setKillTimer(workerId);

  try {
    // Update instance status to "running" in Cosmos DB
    await updateInstanceStatus(workerId, 'running');

    await sendSystemMessage(workerId, 'the instance has successfully launched!');
    tracker.startResume();
  } catch (e) {
    await sendSystemMessage(workerId, `An error occurred: ${e}`);
    console.error(e);
  }

  return tracker;
};
