import { onMessageReceived, resume } from './agent';
import './common/signal-handler';
import { setKillTimer, pauseKillTimer, restartKillTimer } from './common/kill-timer';
import { CancellationToken } from './common/cancellation-token';
import { sendSystemMessage, updateInstanceStatus, workerEventSchema } from '@remote-swe-agents-azure/agent-core/lib';
import { updateAgentStatusWithEvent } from './common/status';
import { refreshSession } from './common/refresh-session';

// Azure Event Hubs または Service Bus を使用する場合の準備
// TODO: AWS Amplify Events を Azure Event Hubs/Service Bus に置き換える
Object.assign(global, { WebSocket: require('ws') });

const eventHttpEndpoint = process.env.EVENT_HTTP_ENDPOINT;

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
        sendSystemMessage(this.workerId, `An error occurred: ${e}`).catch((e) => console.log(e));
        console.log(e);
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
        sendSystemMessage(this.workerId, `An error occurred: ${e}`).catch((e) => console.log(e));
        console.log(e);
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
      console.log(`cancelled an ongoing converse session.`);
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
    console.log(`The worker ${workerId} is already started.`);
    return;
  }

  isStarted[workerId] = true;
  const tracker = new ConverseSessionTracker(workerId);

  // TODO: Azure Service Bus または Event Hubs を使用したイベント購読
  // 現在は簡易的なポーリング方式で実装
  let pollingInterval: NodeJS.Timeout | null = null;

  const startEventPolling = () => {
    // 5秒ごとにセッションの状態をチェック
    pollingInterval = setInterval(async () => {
      try {
        // セッションの状態をチェック（必要に応じて実装）
        // 現時点では、エージェントはwebappからのメッセージを受信するまで待機
      } catch (error) {
        console.error('Error polling events:', error);
      }
    }, 5000);
  };

  const stopEventPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };

  startEventPolling();

  // プロセス終了時にポーリングを停止
  process.on('SIGINT', stopEventPolling);
  process.on('SIGTERM', stopEventPolling);

  setKillTimer(workerId);

  try {
    // Update instance status to "running" in Cosmos DB
    await updateInstanceStatus(workerId, 'running');

    await sendSystemMessage(workerId, 'the instance has successfully launched!');
    tracker.startResume();
  } catch (e) {
    await sendSystemMessage(workerId, `An error occurred: ${e}`);
    console.log(e);
  }

  return tracker;
};
