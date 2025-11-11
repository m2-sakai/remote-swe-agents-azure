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
  const session = await getMsalSession();
  
  if (!session || !session.account) {
    throw new Error('session not found');
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
