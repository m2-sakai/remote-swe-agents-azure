# Azure移行計画 - Remote SWE Agents

## 📋 概要

このドキュメントは、AWS上に構築されたRemote SWE AgentsをAzureに移行するための詳細な計画書です。

### 現在の構成（AWS）

```
┌─────────────────────────────────────────────────────────┐
│                    WebApp (Next.js)                      │
│  - AWS Amplify (認証・デプロイ)                           │
│  - Amazon Cognito (ユーザー認証)                         │
│  - AWS Lambda (非同期ジョブ処理)                          │
│  - AWS Systems Manager Parameter Store (設定管理)        │
│  - Amazon DynamoDB (データストア)                         │
│  - Amazon S3 (画像・ファイルストレージ)                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Worker (Node.js)                      │
│  - Amazon EC2 (ワーカーインスタンス)                      │
│  - Amazon Bedrock (LLM連携)                              │
│  - Amazon DynamoDB (セッション管理)                       │
│  - Amazon S3 (データ共有)                                │
└─────────────────────────────────────────────────────────┘
```

### 目標構成（Azure）

```
┌─────────────────────────────────────────────────────────┐
│                    WebApp (Next.js)                      │
│  - Azure App Service (ホスティング)                       │
│  - Microsoft Entra ID (旧Azure AD - ユーザー認証)        │
│  - Azure Functions (非同期ジョブ処理)                     │
│  - Azure App Configuration (設定管理)                    │
│  - Azure Cosmos DB (データストア)                        │
│  - Azure Blob Storage (画像・ファイルストレージ)          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Worker (Node.js)                      │
│  - Azure Virtual Machines (ワーカーインスタンス)          │
│  - Azure OpenAI Service (LLM連携)                        │
│  - Azure Cosmos DB (セッション管理)                       │
│  - Azure Blob Storage (データ共有)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 フェーズ1: WebApp移行（優先）

### ステップ1: 認証基盤の移行

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | 用途 |
|-------------|---------------|------|
| Amazon Cognito | Microsoft Entra ID (Azure AD B2C) | ユーザー認証・OAuth2.0 |
| AWS Amplify Auth | @azure/msal-node, @azure/msal-react | 認証SDK |

#### 実装タスク

**1.1 Microsoft Entra IDのセットアップ**
- [ ] Azure Portal で Entra ID テナントを作成
- [ ] アプリケーション登録（App Registration）を作成
- [ ] リダイレクトURI設定: `https://<your-app>.azurewebsites.net/auth/callback`
- [ ] クライアントシークレットの生成
- [ ] 必要なスコープ設定（openid, profile, email）

**1.2 コード修正**

修正対象ファイル:
- `packages/webapp/src/lib/amplifyServerUtils.ts` → 削除
- `packages/webapp/src/lib/auth.ts` → Azure認証に書き換え
- `packages/webapp/src/middleware.ts` → MSAL認証チェックに書き換え
- `packages/webapp/src/lib/safe-action.ts` → MSAL tokenに基づく認証

新規作成ファイル:
- `packages/webapp/src/lib/msal-config.ts` - MSAL設定
- `packages/webapp/src/lib/azure-auth.ts` - Azure認証ヘルパー

**1.3 環境変数の更新**

`.env.local` の変更:
```bash
# 削除
# COGNITO_DOMAIN=
# USER_POOL_CLIENT_ID=
# USER_POOL_ID=

# 追加
AZURE_AD_CLIENT_ID=<your-client-id>
AZURE_AD_CLIENT_SECRET=<your-client-secret>
AZURE_AD_TENANT_ID=<your-tenant-id>
AZURE_AD_REDIRECT_URI=https://<your-app>.azurewebsites.net/auth/callback
```

**1.4 package.json依存関係の更新**

削除:
```json
"@aws-amplify/adapter-nextjs": "1.6.2",
"aws-amplify": "^6.14.2"
```

追加:
```json
"@azure/msal-node": "^2.x",
"@azure/msal-react": "^2.x",
"@azure/identity": "^4.x"
```

---

### ステップ2: データベース移行（DynamoDB → Cosmos DB）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | API互換性 |
|-------------|---------------|-----------|
| Amazon DynamoDB | Azure Cosmos DB (NoSQL API) | 類似（SDKは異なる） |
| @aws-sdk/lib-dynamodb | @azure/cosmos | 要書き換え |

#### 実装タスク

**2.1 Cosmos DBのセットアップ**
- [ ] Cosmos DBアカウントを作成（NoSQL APIを選択）
- [ ] データベース作成: `remote-swe-agents`
- [ ] コンテナ作成:
  - `sessions` (パーティションキー: `/PK`)
  - `api-keys` (パーティションキー: `/userId`)
  - `pull-requests` (パーティションキー: `/workerId`)
  - `preferences` (パーティションキー: `/userId`)

**2.2 データアクセスレイヤーの書き換え**

修正対象ファイル（agent-core）:
- `packages/agent-core/src/lib/sessions.ts`
- `packages/agent-core/src/lib/api-key.ts`
- `packages/agent-core/src/lib/messages.ts`
- `packages/agent-core/src/lib/preferences.ts`
- `packages/agent-core/src/tools/create-pr/index.ts`

新規作成:
- `packages/agent-core/src/lib/azure/cosmos.ts` - Cosmos DBクライアント
- `packages/agent-core/src/lib/azure/types.ts` - Azure型定義

**2.3 クエリパターンの書き換え**

DynamoDB → Cosmos DBの変換例:

```typescript
// Before (DynamoDB)
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TableName } from './aws';

const result = await ddb.send(
  new GetCommand({
    TableName,
    Key: { PK: 'sessions', SK: workerId }
  })
);

// After (Cosmos DB)
import { cosmosClient, databaseId } from './azure/cosmos';

const container = cosmosClient.database(databaseId).container('sessions');
const { resource } = await container.item(workerId, 'sessions').read();
```

**2.4 インデックス設定**

Cosmos DBでLSI1相当のインデックスを作成:
```json
{
  "indexingPolicy": {
    "includedPaths": [
      {
        "path": "/LSI1/?"
      }
    ],
    "excludedPaths": [
      {
        "path": "/*"
      }
    ]
  }
}
```

---

### ステップ3: ストレージ移行（S3 → Blob Storage）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | 用途 |
|-------------|---------------|------|
| Amazon S3 | Azure Blob Storage | オブジェクトストレージ |
| @aws-sdk/client-s3 | @azure/storage-blob | SDK |
| @aws-sdk/s3-request-presigner | BlobSASSignatureValues | 署名付きURL |

#### 実装タスク

**3.1 Blob Storageのセットアップ**
- [ ] ストレージアカウントを作成
- [ ] コンテナを作成:
  - `images` - 画像ファイル
  - `attachments` - 添付ファイル
- [ ] CORS設定（Next.jsアプリからのアクセス用）
- [ ] アクセスキーまたはManaged Identityの設定

**3.2 コード修正**

修正対象ファイル:
- `packages/agent-core/src/tools/send-image/index.ts`
- `packages/webapp/src/actions/image/*` （画像アップロード処理）
- `packages/webapp/src/actions/upload/*`

新規作成:
- `packages/agent-core/src/lib/azure/blob-storage.ts`

**3.3 署名付きURL生成の書き換え**

```typescript
// Before (S3)
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const command = new GetObjectCommand({
  Bucket: BucketName,
  Key: key
});
const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

// After (Blob Storage)
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

const sasToken = generateBlobSASQueryParameters({
  containerName: 'images',
  blobName: key,
  permissions: BlobSASPermissions.parse('r'),
  startsOn: new Date(),
  expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
}, sharedKeyCredential).toString();

const url = `${blobClient.url}?${sasToken}`;
```

---

### ステップ4: 非同期処理移行（Lambda → Azure Functions）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | トリガー方式 |
|-------------|---------------|-------------|
| AWS Lambda | Azure Functions | HTTP, Queue, Timer |
| @aws-sdk/client-lambda | @azure/functions | 要書き換え |

#### 実装タスク

**4.1 Azure Functionsプロジェクトの作成**

```bash
cd packages/webapp
mkdir azure-functions
cd azure-functions
func init --typescript
func new --template "HTTP trigger" --name AsyncJobHandler
```

**4.2 既存のLambdaコードを移行**

移行元:
- `packages/webapp/src/jobs/async-job-runner.ts`

移行先:
- `packages/webapp/azure-functions/AsyncJobHandler/index.ts`

```typescript
// Azure Functions版
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { z } from 'zod';

const jobPayloadPropsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('example'),
  }),
]);

export async function AsyncJobHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const body = await request.json();
  const { data: payload, error } = jobPayloadPropsSchema.safeParse(body);
  
  if (error) {
    context.log(error);
    return { status: 400, body: error.toString() };
  }

  switch (payload.type) {
    case 'example':
      context.log('example job processed');
      break;
  }

  return { status: 200, body: 'Job processed' };
}

app.http('AsyncJobHandler', {
  methods: ['POST'],
  authLevel: 'function',
  handler: AsyncJobHandler
});
```

**4.3 呼び出し側の修正**

修正対象:
- `packages/webapp/src/lib/jobs.ts`

```typescript
// Before (Lambda)
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient();
await lambda.send(
  new InvokeCommand({
    FunctionName: process.env.ASYNC_JOB_HANDLER_ARN,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify(payload))
  })
);

// After (Azure Functions)
const functionUrl = process.env.AZURE_FUNCTION_URL;
const functionKey = process.env.AZURE_FUNCTION_KEY;

await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-functions-key': functionKey
  },
  body: JSON.stringify(payload)
});
```

---

### ステップ5: 設定管理移行（SSM Parameter Store → Key Vault）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | 用途 |
|-------------|---------------|------|
| AWS Systems Manager Parameter Store | Azure Key Vault | シークレット・設定管理 |
| @aws-sdk/client-ssm | @azure/keyvault-secrets | SDK |

#### 実装タスク

**5.1 Key Vaultのセットアップ**
- [ ] Key Vaultを作成
- [ ] シークレットを登録:
  - `webapp-origin` - WebAppのオリジンURL
  - `azure-openai-api-key` - Azure OpenAI APIキー
  - `cosmos-db-connection-string` - Cosmos DB接続文字列
  - `storage-account-connection-string` - Storage Account接続文字列
  - `entra-id-client-secret` - Entra IDクライアントシークレット
- [ ] App ServiceのManaged Identityにアクセス権限を付与（Key Vault Secrets User）
- [ ] WorkerのManaged Identityにアクセス権限を付与（Key Vault Secrets User）

**5.2 App ServiceでのKey Vault参照設定**

App Serviceの環境変数でKey Vault参照を使用:
```bash
# Application Settings
WEBAPP_ORIGIN=@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/webapp-origin/)
AZURE_OPENAI_API_KEY=@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/azure-openai-api-key/)
COSMOS_DB_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/cosmos-db-connection-string/)
STORAGE_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/storage-account-connection-string/)
```

**5.3 コード修正（ランタイムでのアクセスが必要な場合）**

修正対象:
- `packages/webapp/src/lib/origin.ts`

新規作成:
- `packages/agent-core/src/lib/azure/keyvault.ts`

```typescript
// packages/agent-core/src/lib/azure/keyvault.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const vaultUrl = process.env.AZURE_KEYVAULT_URL!;
const credential = new DefaultAzureCredential();
const client = new SecretClient(vaultUrl, credential);

export async function getSecret(secretName: string): Promise<string> {
  const secret = await client.getSecret(secretName);
  return secret.value!;
}

// キャッシュ機能付き（オプション）
const secretCache = new Map<string, { value: string; expiry: number }>();

export async function getCachedSecret(
  secretName: string, 
  cacheDurationMs: number = 300000 // 5分
): Promise<string> {
  const cached = secretCache.get(secretName);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  const value = await getSecret(secretName);
  secretCache.set(secretName, {
    value,
    expiry: Date.now() + cacheDurationMs
  });
  
  return value;
}
```

```typescript
// packages/webapp/src/lib/origin.ts の更新
// Before (SSM)
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient();
const result = await ssm.send(
  new GetParameterCommand({
    Name: '/remote-swe-agents/webapp-origin'
  })
);
const origin = result.Parameter?.Value;

// After (Key Vault) - 環境変数から直接取得（推奨）
const origin = process.env.WEBAPP_ORIGIN;

// または、ランタイムでKey Vaultから取得する場合
import { getSecret, getCachedSecret } from '@remote-swe-agents/agent-core/azure/keyvault';
const origin = await getCachedSecret('webapp-origin');
```

**5.4 Bicepテンプレートでの設定**

```bicep
// Key Vault作成
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${appName}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // RBAC方式を使用
    enabledForTemplateDeployment: true
  }
}

// App ServiceのManaged Identityに権限付与
resource kvSecretUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appService.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

---

### ステップ6: デプロイメント（App Service）

#### 実装タスク

**6.1 App Serviceのセットアップ**
- [ ] App Service Planを作成（B1以上推奨）
- [ ] App Serviceを作成（Node.js 20 LTS）
- [ ] 環境変数を設定（Application Settings）

**6.2 Bicepテンプレートの作成**

作成ファイル:
- `bicep/templates/webapp.bicep` - WebApp用インフラ
- `bicep/parameters/webapp.dev.bicepparam` - 開発環境パラメータ

```bicep
// bicep/templates/webapp.bicep
@description('アプリケーション名')
param appName string

@description('リージョン')
param location string = resourceGroup().location

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true // Linux
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      nodeVersion: '20-lts'
      appSettings: [
        {
          name: 'AZURE_AD_CLIENT_ID'
          value: '@Microsoft.KeyVault(SecretUri=...)'
        }
        // ... その他の環境変数
      ]
    }
  }
}
```

**6.3 CI/CDパイプライン設定**

GitHub Actionsワークフロー:
```yaml
# .github/workflows/deploy-webapp.yml
name: Deploy WebApp to Azure

on:
  push:
    branches: [main]
    paths:
      - 'packages/webapp/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd packages/webapp
          npm ci
      
      - name: Build
        run: |
          cd packages/webapp
          npm run build
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: packages/webapp
```

---

## 🎯 フェーズ2: Worker移行

### ステップ7: Worker VM移行（EC2 → Azure VM）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | 用途 |
|-------------|---------------|------|
| Amazon EC2 | Azure Virtual Machines | ワーカーインスタンス |
| EC2 Instance Metadata Service | Azure Instance Metadata Service | インスタンス情報取得 |
| @aws-sdk/client-ec2 | @azure/arm-compute | VM管理SDK |

#### 実装タスク

**7.1 Azure VMのセットアップ**
- [ ] VMイメージの選択（Ubuntu 22.04 LTS推奨）
- [ ] VM SKUの選択（Standard_D2s_v3以上推奨）
- [ ] ネットワークセキュリティグループ設定
- [ ] Managed Identityの有効化

**7.2 Workerコードの修正**

修正対象ファイル:
- `packages/worker/src/common/ec2.ts` → `azure-vm.ts`にリネーム・書き換え
- `packages/worker/src/entry.ts` - 初期化処理をAzure対応

```typescript
// Before (EC2)
const token = await fetch('http://169.254.169.254/latest/api/token', {
  method: 'PUT',
  headers: {
    'X-aws-ec2-metadata-token-ttl-seconds': '900'
  }
}).then(res => res.text());

// After (Azure VM)
const metadata = await fetch('http://169.254.169.254/metadata/instance?api-version=2021-02-01', {
  headers: {
    'Metadata': 'true'
  }
}).then(res => res.json());
```

**7.3 VM起動スクリプト（cloud-init）の作成**

```yaml
#cloud-config
package_update: true
package_upgrade: true

packages:
  - nodejs
  - npm
  - git

runcmd:
  - git clone <your-repo-url> /opt/remote-swe-agent
  - cd /opt/remote-swe-agent/packages/worker
  - npm install
  - npm run build
  - node dist/main.js
```

---

### ステップ8: LLM連携移行（Bedrock → Azure OpenAI）

#### AWS → Azure サービスマッピング

| AWS サービス | Azure サービス | モデル |
|-------------|---------------|--------|
| Amazon Bedrock | Azure OpenAI Service | GPT-4, GPT-4o, etc. |
| @aws-sdk/client-bedrock-runtime | openai (Azure設定) | SDK |

#### 実装タスク

**8.1 Azure OpenAI Serviceのセットアップ**
- [ ] Azure OpenAI リソースを作成
- [ ] モデルデプロイ（gpt-4o推奨）
- [ ] エンドポイントURLとAPIキーを取得

**8.2 LLM呼び出しコードの書き換え**

修正対象:
- `packages/agent-core/src/lib/converse.ts`

```typescript
// Before (Bedrock)
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const response = await bedrock.send(
  new ConverseCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    messages: messages,
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.7
    }
  })
);

// After (Azure OpenAI)
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

const response = await openai.chat.completions.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT,
  messages: messages,
  max_tokens: 4096,
  temperature: 0.7
});
```

**8.3 環境変数の更新**

```bash
# Worker .env
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<your-api-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

---

## 📦 依存関係の更新

### WebApp (packages/webapp/package.json)

**削除する依存関係:**
```json
{
  "@aws-amplify/adapter-nextjs": "1.6.2",
  "@aws-sdk/client-lambda": "^3.799.0",
  "@aws-sdk/client-ssm": "^3.812.0",
  "@aws-sdk/s3-request-presigner": "^3.824.0",
  "aws-amplify": "^6.14.2"
}
```

**追加する依存関係:**
```json
{
  "@azure/msal-node": "^2.15.0",
  "@azure/msal-react": "^2.1.0",
  "@azure/identity": "^4.5.0",
  "@azure/storage-blob": "^12.25.0",
  "@azure/keyvault-secrets": "^4.9.0"
}
```

### Agent Core (packages/agent-core/package.json)

**削除する依存関係:**
```json
{
  "@aws-sdk/client-bedrock-runtime": "^3.x",
  "@aws-sdk/client-ec2": "^3.x",
  "@aws-sdk/client-s3": "^3.x",
  "@aws-sdk/lib-dynamodb": "^3.x",
  "@aws-sdk/credential-provider-node": "^3.x"
}
```

**追加する依存関係:**
```json
{
  "@azure/cosmos": "^4.2.0",
  "@azure/storage-blob": "^12.25.0",
  "@azure/identity": "^4.5.0",
  "@azure/keyvault-secrets": "^4.9.0",
  "openai": "^4.77.0"
}
```

### Worker (packages/worker/package.json)

**追加する依存関係:**
```json
{
  "@azure/arm-compute": "^21.1.0",
  "@azure/identity": "^4.5.0"
}
```

---

## 🔒 セキュリティ考慮事項

### 1. 認証情報の管理

**Azure Key Vaultの使用:**
- すべてのシークレット（APIキー、接続文字列）をKey Vaultに保存
- App ServiceからManaged Identityでアクセス
- 環境変数には `@Microsoft.KeyVault(SecretUri=...)` 形式で参照

### 2. Managed Identityの活用

- App Service → Cosmos DB, Blob Storage
- Azure VM (Worker) → Cosmos DB, Blob Storage, OpenAI
- Azure Functions → すべてのAzureリソース

#### 3. ネットワークセキュリティ

- Private Endpointの設定（Cosmos DB, Storage Account, Key Vault）
- VNetインテグレーション（App Service → Private Endpoint）
- NSG設定（VM）

#### 4. Key Vault ベストプラクティス

- **環境変数からの参照を優先**: App Serviceでは `@Microsoft.KeyVault(...)` 形式で環境変数に設定し、コード内では `process.env` から取得
- **キャッシュの活用**: ランタイムでKey Vaultにアクセスする場合は、頻繁なAPI呼び出しを避けるためキャッシュを実装
- **RBAC方式を使用**: アクセスポリシーではなくRBAC（Role-Based Access Control）で権限管理
- **監査ログの有効化**: Key Vaultの診断設定でLog Analyticsに監査ログを送信

---

## 📊 コスト見積もり（月額・東日本リージョン想定）

| リソース | SKU/プラン | 想定コスト |
|---------|-----------|-----------|
| App Service | B1 (Basic) | ¥1,800 |
| Cosmos DB | 400 RU/s プロビジョニング | ¥3,000 |
| Blob Storage | 10GB + トランザクション | ¥300 |
| Azure Functions | 従量課金 (100万実行/月) | ¥200 |
| Azure VM | Standard_D2s_v3 (2vCPU, 8GB) | ¥10,000 |
| Azure OpenAI | gpt-4o (100万トークン/月) | ¥10,000 |
| Key Vault | 標準 (10,000トランザクション/月) | ¥500 |
| **合計** | | **約 ¥25,500/月** |

*実際のコストは利用量によって変動します*

---

## 🗓️ 推奨スケジュール

### 週1-2: WebApp移行準備
- Azure環境のセットアップ
- Entra ID / Cosmos DB / Blob Storage 作成
- ローカル開発環境でのAzure SDK動作確認

### 週3-4: WebApp移行実装
- 認証機能の書き換え
- データアクセス層の書き換え
- ストレージアクセスの書き換え

### 週5: WebApp統合テスト・デプロイ
- ステージング環境へのデプロイ
- 統合テスト
- 本番環境デプロイ

### 週6-7: Worker移行実装
- VM環境のセットアップ
- Azure OpenAI連携実装
- データアクセス層の共通化

### 週8: Worker統合テスト・デプロイ
- E2Eテスト（WebApp ↔ Worker）
- 本番環境デプロイ
- モニタリング設定

---

## 📝 チェックリスト

### フェーズ1: WebApp移行

#### 認証
- [ ] Entra ID テナント作成
- [ ] アプリケーション登録完了
- [ ] MSAL SDK導入
- [ ] 認証フロー動作確認

#### データベース
- [ ] Cosmos DB アカウント作成
- [ ] コンテナ作成
- [ ] データアクセス層書き換え
- [ ] クエリ動作確認

#### ストレージ
- [ ] Storage Account作成
- [ ] Blob Storage SDK導入
- [ ] 画像アップロード動作確認
- [ ] 署名付きURL生成確認

#### 非同期処理
- [ ] Azure Functions作成
- [ ] ジョブハンドラー実装
- [ ] WebAppからの呼び出し確認

#### デプロイメント
- [ ] App Service作成
- [ ] 環境変数設定
- [ ] CI/CDパイプライン構築
- [ ] 本番デプロイ

### フェーズ2: Worker移行

#### VM
- [ ] Azure VM作成
- [ ] ネットワーク設定
- [ ] Managed Identity設定
- [ ] 起動スクリプト動作確認

#### LLM
- [ ] Azure OpenAI Service作成
- [ ] モデルデプロイ
- [ ] SDK導入
- [ ] 会話API動作確認

#### 統合
- [ ] WebApp ↔ Worker通信確認
- [ ] セッション管理動作確認
- [ ] E2Eテスト完了

---

## 🆘 トラブルシューティング

### よくある問題と対策

#### 1. 認証エラー
- Entra IDのリダイレクトURIが正しく設定されているか確認
- クライアントシークレットの有効期限を確認
- MSALのキャッシュをクリア

#### 2. Cosmos DB接続エラー
- 接続文字列が正しいか確認
- ファイアウォール設定でアクセス許可されているか確認
- パーティションキーが正しく設定されているか確認

#### 3. Blob Storage アクセスエラー
- SASトークンの有効期限を確認
- CORS設定を確認
- コンテナのアクセスレベルを確認

#### 4. Azure OpenAI レート制限
- デプロイメントのTPM（Tokens Per Minute）制限を確認
- リトライロジックの実装
- バックオフ戦略の実装

---

## 📚 参考リソース

### Azure公式ドキュメント
- [Azure App Service](https://learn.microsoft.com/ja-jp/azure/app-service/)
- [Microsoft Entra ID](https://learn.microsoft.com/ja-jp/entra/identity/)
- [Azure Cosmos DB](https://learn.microsoft.com/ja-jp/azure/cosmos-db/)
- [Azure Blob Storage](https://learn.microsoft.com/ja-jp/azure/storage/blobs/)
- [Azure Key Vault](https://learn.microsoft.com/ja-jp/azure/key-vault/)
- [Azure OpenAI Service](https://learn.microsoft.com/ja-jp/azure/ai-services/openai/)

### マイグレーションガイド
- [AWS to Azure サービスマッピング](https://learn.microsoft.com/ja-jp/azure/architecture/aws-professional/services)
- [DynamoDB to Cosmos DB マイグレーション](https://learn.microsoft.com/ja-jp/azure/cosmos-db/nosql/migrate-dynamodb)
- [S3 to Blob Storage マイグレーション](https://learn.microsoft.com/ja-jp/azure/storage/solution-integration/validated-partners/data-management/migration-tools-comparison)

---

## 🎉 まとめ

この移行計画に従うことで、AWS上のRemote SWE AgentsをAzureに段階的に移行できます。

**重要なポイント:**
1. **WebAppから優先的に移行** - ユーザー向け機能を先に安定化
2. **段階的な移行** - 一度にすべてを変更せず、機能ごとに移行
3. **テストの徹底** - 各ステップで動作確認を実施
4. **ドキュメント化** - 変更内容を記録し、チーム全体で共有

ご不明な点があれば、各セクションの詳細について質問してください。
