# WebApp Azure移行 - 実装完了サマリー

## ✅ 完了した作業

### 1. Azure基盤ライブラリの作成 ✓
以下のファイルを作成しました：
- `packages/agent-core/src/lib/azure/cosmos.ts` - Cosmos DB クライアント
- `packages/agent-core/src/lib/azure/blob-storage.ts` - Blob Storage クライアント
- `packages/agent-core/src/lib/azure/keyvault.ts` - Key Vault クライアント
- `packages/agent-core/src/lib/azure/index.ts` - まとめエクスポート

### 2. 認証システムの移行（Cognito → Entra ID） ✓
- `packages/webapp/src/lib/msal-config.ts` - MSAL設定ファイル作成
- `packages/webapp/src/lib/azure-auth.ts` - Azure認証ヘルパー作成
- `packages/webapp/src/lib/auth.ts` - AWS Amplify → MSAL に書き換え
- `packages/webapp/src/middleware.ts` - 認証ミドルウェアをMSAL対応に書き換え
- `packages/webapp/src/lib/safe-action.ts` - Server ActionをMSAL対応に書き換え

#### 認証エンドポイントの作成 ✓
- `packages/webapp/src/app/api/auth/sign-in/route.ts` - サインイン
- `packages/webapp/src/app/api/auth/callback/route.ts` - 認証コールバック
- `packages/webapp/src/app/api/auth/sign-out/route.ts` - サインアウト

### 3. package.jsonの更新 ✓

#### agent-core
```json
{
  "dependencies": {
    "@azure/cosmos": "^4.2.0",
    "@azure/identity": "^4.5.0",
    "@azure/keyvault-secrets": "^4.9.0",
    "@azure/storage-blob": "^12.25.0"
  },
  "exports": {
    "./azure": {
      "types": "./dist/lib/azure/index.d.ts",
      "default": "./dist/lib/azure/index.js"
    }
  }
}
```

#### webapp
```json
{
  "dependencies": {
    "@azure/identity": "^4.5.0",
    "@azure/keyvault-secrets": "^4.9.0",
    "@azure/msal-node": "^2.15.0",
    "@azure/storage-blob": "^12.25.0"
  }
}
```

削除したAWS依存関係:
- `@aws-amplify/adapter-nextjs`
- `@aws-sdk/client-lambda`
- `@aws-sdk/client-ssm`
- `@aws-sdk/s3-request-presigner`
- `aws-amplify`

### 4. 環境変数の更新 ✓
`.env.local.example` を更新:
- Azure Entra ID設定
- Cosmos DB設定
- Blob Storage設定
- Key Vault設定
- Azure Functions設定

---

## 📋 次のステップ

### すぐに実行すべきこと

#### 1. 依存関係のインストール
```bash
cd packages/agent-core
npm install

cd ../webapp
npm install
```

#### 2. Azure リソースのセットアップ
移行計画書（`AZURE_MIGRATION_PLAN.md`）を参照して、以下のリソースを作成：

**必須リソース:**
1. **Microsoft Entra ID (Azure AD)**
   - アプリケーション登録を作成
   - リダイレクトURI: `http://localhost:3011/auth/callback`
   - クライアントシークレットを生成
   - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` を取得

2. **Azure Cosmos DB**
   - NoSQL APIでアカウント作成
   - データベース: `remote-swe-agents`
   - コンテナ: `sessions`, `api-keys`, `preferences` など
   - 接続文字列を取得

3. **Azure Blob Storage**
   - ストレージアカウント作成
   - コンテナ: `remote-swe-agents`
   - 接続文字列を取得

4. **Azure Key Vault**
   - Key Vaultを作成
   - Managed Identityでアクセス設定
   - URL を取得

#### 3. 環境変数の設定
`.env.local` ファイルを作成（`.env.local.example` をコピー）:
```bash
cd packages/webapp
cp .env.local.example .env.local
# 各値を実際のAzure リソースの値で置き換える
```

### 残りの移行タスク

#### 🔄 進行中のタスク

**3. データアクセス層の移行 (DynamoDB → Cosmos DB)**
- 以下のファイルでDynamoDBクライアントをCosmos DBに置き換え:
  - `packages/agent-core/src/lib/sessions.ts`
  - `packages/agent-core/src/lib/api-key.ts`
  - `packages/agent-core/src/lib/messages.ts`
  - `packages/agent-core/src/lib/preferences.ts`
  - その他DynamoDBを使用しているファイル

例:
```typescript
// Before
import { ddb, TableName } from './aws';
await ddb.send(new GetCommand({ TableName, Key: { PK, SK } }));

// After
import { getItem } from './azure/cosmos';
await getItem('container-name', id, partitionKey);
```

**4. ストレージ層の移行 (S3 → Blob Storage)**
- 画像アップロード処理の書き換え
- S3クライアント呼び出しをBlob Storageに置き換え

**5. 非同期処理の移行 (Lambda → Azure Functions)**
- `packages/webapp/src/jobs/async-job-runner.ts` を Azure Functions に移行
- 呼び出し側 (`src/lib/jobs.ts`) を更新

**6. 設定管理の移行 (SSM → Key Vault)**
- `packages/webapp/src/lib/origin.ts` を Key Vault 対応に更新

---

## 🧪 テスト手順

### ローカル開発環境でのテスト

1. **依存関係のインストール確認**
```bash
cd packages/agent-core
npm run build

cd ../webapp
npm run dev
```

2. **認証フローのテスト**
   - `http://localhost:3011` にアクセス
   - サインインページにリダイレクトされることを確認
   - サインインボタンをクリック
   - Azure ADログインページにリダイレクトされることを確認
   - ログイン後、アプリにリダイレクトされることを確認

3. **エラーチェック**
   - ブラウザのコンソールでエラーがないか確認
   - サーバーログでエラーがないか確認

---

## ⚠️ 削除が必要なファイル

以下のファイルは不要になったので削除してください:

```bash
rm packages/webapp/src/lib/amplifyServerUtils.ts
```

---

## 📚 参考ドキュメント

- [Azure Entra ID 認証](https://learn.microsoft.com/ja-jp/entra/identity/)
- [MSAL Node.js](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [Azure Cosmos DB SDK](https://learn.microsoft.com/ja-jp/azure/cosmos-db/nosql/sdk-nodejs)
- [Azure Blob Storage SDK](https://learn.microsoft.com/ja-jp/azure/storage/blobs/storage-quickstart-blobs-nodejs)
- [Azure Key Vault SDK](https://learn.microsoft.com/ja-jp/azure/key-vault/general/)

---

## 🐛 トラブルシューティング

### よくある問題

**問題: TypeScriptエラーが表示される**
→ 解決: `npm install` を実行して依存関係をインストール

**問題: 認証後にエラーが発生する**
→ 解決: Entra IDのリダイレクトURIが正しく設定されているか確認

**問題: Cosmos DBに接続できない**
→ 解決: 接続文字列が正しいか、ファイアウォール設定でローカルIPが許可されているか確認

---

## 📞 サポート

質問や問題があれば、以下を確認してください:
1. 移行計画書 (`AZURE_MIGRATION_PLAN.md`) の該当セクション
2. Azure Portal でリソースが正しく作成されているか
3. 環境変数が正しく設定されているか
