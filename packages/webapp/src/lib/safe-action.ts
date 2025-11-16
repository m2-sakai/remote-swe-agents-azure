/**
 * Safe Action Client with Azure Entra ID authentication
 * Replaced AWS Amplify/Cognito with MSAL
 */
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from 'next-safe-action';
import { getSession, getUserId } from './azure-auth';

export class MyCustomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MyCustomError';
  }
}

const actionClient = createSafeActionClient({
  handleServerError(e) {
    // Log to console.
    console.error('Action error:', e.message);

    // In this case, we can use the 'MyCustomError` class to unmask errors
    // and return them with their actual messages to the client.
    if (e instanceof MyCustomError) {
      return e.message;
    }

    // Every other error that occurs will be masked with the default message.
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authActionClient = actionClient.use(async ({ next }) => {
  // 開発環境: 認証をスキップ
  if (process.env.SKIP_AUTH === 'true') {
    const devUserId = process.env.DEV_USER_ID || 'dev-user-001';
    console.log('[DEV MODE] Auth action with dummy user:', devUserId);
    return next({ ctx: { userId: devUserId } });
  }

  const session = await getSession();

  if (!session || !session.account) {
    throw new Error('Session is not valid!');
  }

  const userId = getUserId(session);
  if (!userId) {
    throw new Error('User ID not found in session!');
  }

  return next({ ctx: { userId } });
});
