/**
 * Application Origin URL
 * Azure: 環境変数に直接設定するか、Key Vault参照を使用
 * 例: @Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/webapp-origin/)
 */
export const AppOrigin = process.env.APP_ORIGIN || process.env.WEBAPP_ORIGIN;
