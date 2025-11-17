/**
 * Azure Authentication Helper
 * MSAL を使用した認証処理
 */
import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { cookies } from 'next/headers';
import { msalConfig, loginRequest } from './msal-config';
import * as sessionStore from './session-store';

// MSAL クライアントインスタンス
const msalInstance = new ConfidentialClientApplication(msalConfig);
const cryptoProvider = new CryptoProvider();

/**
 * ログインURLを生成
 */
export async function getAuthUrl(): Promise<string> {
  const authCodeUrlParameters = {
    scopes: loginRequest.scopes,
    redirectUri: loginRequest.redirectUri,
  };

  const authUrl = await msalInstance.getAuthCodeUrl(authCodeUrlParameters);
  return authUrl;
}

/**
 * 認証コードからトークンを取得
 */
export async function acquireTokenByCode(code: string): Promise<{
  accessToken: string;
  idToken: string;
  account: any;
}> {
  const tokenRequest = {
    code,
    scopes: loginRequest.scopes,
    redirectUri: loginRequest.redirectUri,
  };

  const response = await msalInstance.acquireTokenByCode(tokenRequest);

  if (!response) {
    throw new Error('Failed to acquire token');
  }

  return {
    accessToken: response.accessToken,
    idToken: response.idToken,
    account: response.account,
  };
}

/**
 * セッションからユーザー情報を取得
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionIdCookie = cookieStore.get('session_id');

  if (!sessionIdCookie?.value) {
    return null;
  }

  try {
    // Cosmos DBからセッションデータを取得
    const session = await sessionStore.getSession(sessionIdCookie.value);
    return session;
  } catch (error) {
    console.error('[Auth] Failed to get session:', error);
    return null;
  }
}

/**
 * セッションを保存
 */
export async function setSession(sessionData: {
  accessToken: string;
  idToken: string;
  account: any;
  expiresOn: number;
}) {
  const cookieStore = await cookies();

  // Cosmos DBにセッションデータを保存
  const sessionId = await sessionStore.saveSession(sessionData);

  // HTTPSかどうかを判定（本番環境では必ずHTTPS）
  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ORIGIN?.startsWith('https://');

  // Cookieには軽量なセッションIDのみを保存
  cookieStore.set('session_id', sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  console.log('[Auth] Session saved:', {
    sessionId,
    hasAccessToken: !!sessionData.accessToken,
    hasAccount: !!sessionData.account,
    expiresOn: sessionData.expiresOn,
    expiresInMinutes: sessionData.expiresOn ? Math.floor((sessionData.expiresOn - Date.now() / 1000) / 60) : 'N/A',
    isProduction,
  });
}

/**
 * セッションをクリア
 */
export async function clearSession() {
  const cookieStore = await cookies();
  const sessionIdCookie = cookieStore.get('session_id');

  if (sessionIdCookie?.value) {
    // Cosmos DBからセッションを削除
    await sessionStore.deleteSession(sessionIdCookie.value);
  }

  cookieStore.delete('session_id');
}

/**
 * ログアウトURLを生成
 */
export function getLogoutUrl(): string {
  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  const postLogoutRedirectUri = process.env.APP_ORIGIN || 'http://localhost:3011';

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
}

/**
 * アクセストークンが有効かチェック
 */
export function isTokenValid(expiresOn: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  // 5分のバッファを持たせる
  return expiresOn > now + 300;
}

/**
 * ユーザーIDを取得
 */
export function getUserId(session: any): string | null {
  return session?.account?.homeAccountId || session?.account?.localAccountId || null;
}

export default {
  getAuthUrl,
  acquireTokenByCode,
  getSession,
  setSession,
  clearSession,
  getLogoutUrl,
  isTokenValid,
  getUserId,
};
