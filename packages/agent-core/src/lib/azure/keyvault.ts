/**
 * Azure Key Vault Clientの移行用ヘルパー関数
 */
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

// 環境変数から設定を取得
const vaultUrl = process.env.AZURE_KEYVAULT_URL!;

let secretClient: SecretClient;

/**
 * クライアント初期化
 */
function initializeClient() {
  if (!secretClient) {
    if (!vaultUrl) {
      throw new Error('AZURE_KEYVAULT_URL must be set');
    }

    const credential = new DefaultAzureCredential();
    secretClient = new SecretClient(vaultUrl, credential);
  }
  return secretClient;
}

/**
 * シークレットを取得
 */
export async function getSecret(secretName: string): Promise<string> {
  const client = initializeClient();
  const secret = await client.getSecret(secretName);

  if (!secret.value) {
    throw new Error(`Secret '${secretName}' has no value`);
  }

  return secret.value;
}

/**
 * シークレットをキャッシュ付きで取得
 * 頻繁にアクセスされるシークレットのパフォーマンス最適化
 */
const secretCache = new Map<string, { value: string; expiry: number }>();

export async function getCachedSecret(
  secretName: string,
  cacheDurationMs: number = 300000 // デフォルト5分
): Promise<string> {
  const cached = secretCache.get(secretName);

  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  const value = await getSecret(secretName);

  secretCache.set(secretName, {
    value,
    expiry: Date.now() + cacheDurationMs,
  });

  return value;
}

/**
 * シークレットを設定（管理用）
 */
export async function setSecret(secretName: string, value: string): Promise<void> {
  const client = initializeClient();
  await client.setSecret(secretName, value);

  // キャッシュをクリア
  secretCache.delete(secretName);
}

/**
 * シークレットを削除（管理用）
 */
export async function deleteSecret(secretName: string): Promise<void> {
  const client = initializeClient();
  const poller = await client.beginDeleteSecret(secretName);
  await poller.pollUntilDone();

  // キャッシュをクリア
  secretCache.delete(secretName);
}

/**
 * SSM Parameter Store 互換の getParameter
 */
export async function getParameter(parameterName: string): Promise<string> {
  // SSM のパラメータ名は '/' で始まることが多いので、Key Vault 用に変換
  const secretName = parameterName.replace(/\//g, '-').replace(/^-/, '');
  return await getCachedSecret(secretName);
}

/**
 * キャッシュをクリア
 */
export function clearCache(secretName?: string): void {
  if (secretName) {
    secretCache.delete(secretName);
  } else {
    secretCache.clear();
  }
}

export default {
  getSecret,
  getCachedSecret,
  setSecret,
  deleteSecret,
  getParameter,
  clearCache,
};
