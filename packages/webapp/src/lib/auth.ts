/**
 * Authentication utilities for Azure Entra ID
 * Replaced AWS Amplify/Cognito with MSAL
 */
import { getSession as getMsalSession, getUserId } from './azure-auth';

export class UserNotCreatedError {
  constructor(public readonly userId: string) {}
}

/**
 * Get current authenticated session
 */
export async function getSession() {
  // 開発環境: 認証をスキップしてダミーセッションを返す
  if (process.env.SKIP_AUTH === 'true') {
    const devUserId = process.env.DEV_USER_ID || 'dev-user-001';
    const devUserEmail = process.env.DEV_USER_EMAIL || 'dev@example.com';

    console.log('[DEV MODE] Using dummy session:', { userId: devUserId, email: devUserEmail });

    return {
      userId: devUserId,
      email: devUserEmail,
      accessToken: 'dev-access-token',
    };
  }

  const session = await getMsalSession();

  if (!session || !session.account) {
    throw new Error('[getSession] session not found');
  }

  const userId = getUserId(session);
  if (!userId) {
    throw new Error('User ID not found in session');
  }

  const email = session.account.username || session.account.email;
  if (typeof email !== 'string') {
    throw new Error(`invalid email ${userId}.`);
  }

  return {
    userId,
    email,
    accessToken: session.accessToken,
  };
}
