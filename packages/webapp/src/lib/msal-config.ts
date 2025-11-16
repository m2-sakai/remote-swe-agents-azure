/**
 * Microsoft Authentication Library (MSAL) Configuration
 * Azure Entra ID (旧 Azure AD) 認証設定
 */
import { Configuration, LogLevel } from '@azure/msal-node';

const clientId = process.env.AZURE_AD_CLIENT_ID || 'dummy';
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || 'dummy';
const tenantId = process.env.AZURE_AD_TENANT_ID || 'dummy';
const redirectUri = process.env.AZURE_AD_REDIRECT_URI || 'http://localhost:3011/auth/callback';

// 開発環境で認証をスキップする場合はバリデーションをスキップ
if (process.env.SKIP_AUTH !== 'true' && (!clientId || !clientSecret || !tenantId)) {
  throw new Error(
    'Missing required Azure AD configuration. Please set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID.'
  );
}

/**
 * MSAL Configuration
 */
export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (containsPii) {
          return;
        }
        switch (loglevel) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
      piiLoggingEnabled: false,
      logLevel: process.env.NODE_ENV === 'production' ? LogLevel.Warning : LogLevel.Info,
    },
  },
};

/**
 * スコープ設定
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  redirectUri,
};

/**
 * トークン取得用のリクエスト設定
 */
export const tokenRequest = {
  scopes: ['User.Read'],
  redirectUri,
};

export default msalConfig;
