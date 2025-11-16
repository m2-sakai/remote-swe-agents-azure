# Webapp AWS→Azure 移行計画

## 📊 現状分析

### AWS依存箇所（webapp）

| ファイル                                   | AWS依存                         | 移行先          |
| ------------------------------------------ | ------------------------------- | --------------- |
| `src/app/sessions/new/page.tsx`            | DynamoDB (QueryCommand)         | Cosmos DB       |
| `src/app/sessions/new/actions.ts`          | DynamoDB (TransactWriteCommand) | Cosmos DB       |
| `src/app/sessions/new/template-actions.ts` | DynamoDB (PutCommand, etc.)     | Cosmos DB       |
| `src/app/sessions/[workerId]/page.tsx`     | DynamoDB                        | Cosmos DB       |
| `src/app/sessions/[workerId]/actions.ts`   | S3 (s3Key)                      | Blob Storage    |
| `src/app/cost/page.tsx`                    | DynamoDB                        | Cosmos DB       |
| `src/jobs/async-job-runner.ts`             | Lambda Handler                  | Azure Functions |

### agent-core 依存

webappは`@remote-swe-agents-azure/agent-core`に依存:

- ✅ Azure実装済み: `azure/cosmos.ts`, `azure/blob-storage.ts`, `azure/keyvault.ts`
- ⚠️ 未完成: Cosmos DB/Blob Storageの完全互換API

## 🎯 移行戦略

### フェーズ1: agent-core Azure実装の完成

**優先順位: 最高**

agent-coreで以下のAzure実装を完成させる:

#### 1.1 Cosmos DB操作（DynamoDB互換）

**ファイル**: `packages/agent-core/src/lib/azure/cosmos.ts`

**必要な操作:**

- ✅ `query()` - 既存実装あり
- ✅ `get()` - 既存実装あり
- ✅ `put()` - 既存実装あり
- ✅ `update()` - 既存実装あり
- ✅ `delete()` - 既存実装あり
- ⚠️ `transactWrite()` - **未実装**（重要）
- ⚠️ `batchWrite()` - **未実装**

**対応:**

```typescript
// DynamoDB互換のトランザクション操作
export async function transactWrite(items: TransactWriteItem[]) {
  // Cosmos DBのトランザクション実装
}
```

#### 1.2 Blob Storage操作（S3互換）

**ファイル**: `packages/agent-core/src/lib/azure/blob-storage.ts`

**必要な操作:**

- ✅ `uploadBlob()` - 既存実装あり
- ✅ `downloadBlob()` - 既存実装あり
- ⚠️ `writeBytesToKey(key, bytes)` - **未実装**（S3互換名）
- ⚠️ `getBytesFromKey(key)` - **未実装**（S3互換名）

**対応:**

```typescript
// S3互換のエイリアス関数
export async function writeBytesToKey(key: string, bytes: Buffer) {
  return uploadBlob(key, bytes);
}

export async function getBytesFromKey(key: string): Promise<Buffer> {
  return downloadBlob(key);
}
```

#### 1.3 エクスポートの整理

**ファイル**: `packages/agent-core/src/lib/azure/index.ts`

**必要な追加:**

```typescript
export * from './cosmos';
export * from './blob-storage';
export * from './keyvault';

// DynamoDB互換エクスポート
export { cosmosClient as ddb } from './cosmos';
export const TableName = process.env.AZURE_COSMOS_CONTAINER_NAME || 'remote-swe-agents';
export const ContainerName = TableName; // Cosmos DB用
```

### フェーズ2: Webapp インポート修正

**優先順位: 高**

すべてのwebappファイルで、AWSインポートをAzureに置き換え。

#### 2.1 sessions/new/page.tsx

**変更前:**

```typescript
import { ddb, TableName } from '@remote-swe-agents-azure/agent-core/aws';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const response = await ddb.send(
  new QueryCommand({
    TableName,
    // ...
  })
);
```

**変更後:**

```typescript
import { cosmos, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';

const response = await cosmos.query({
  containerName: ContainerName,
  // ...
});
```

#### 2.2 sessions/new/actions.ts

**変更前:**

```typescript
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TableName } from '@remote-swe-agents-azure/agent-core/aws';

await ddb.send(
  new TransactWriteCommand({
    TransactItems: [...]
  })
);
```

**変更後:**

```typescript
import { cosmos, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';

await cosmos.transactWrite([
  // トランザクションアイテム
]);
```

#### 2.3 sessions/new/template-actions.ts

**変更前:**

```typescript
import { ddb, TableName } from '@remote-swe-agents-azure/agent-core/aws';
import { PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
```

**変更後:**

```typescript
import { cosmos, ContainerName } from '@remote-swe-agents-azure/agent-core/azure';
// put, update, delete は cosmos オブジェクトのメソッドとして使用
```

#### 2.4 sessions/[workerId]/actions.ts

**S3キー参照の修正:**

```typescript
// 変更前
s3Key: key,

// 変更後
blobKey: key, // または storageKey
```

#### 2.5 cost/page.tsx

DynamoDB → Cosmos DB クエリに変更。

### フェーズ3: Lambda → Azure Functions対応

**優先順位: 中**

#### 3.1 async-job-runner.ts

**変更前:**

```typescript
import { Handler } from 'aws-lambda';

export const handler: Handler = async (event, context) => {
  // ...
};
```

**変更後:**

```typescript
import { AzureFunction, Context, HttpRequest } from '@azure/functions';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  // ...
};

export default httpTrigger;
```

### フェーズ4: 環境変数の整理

**.env.local の更新:**

```bash
# 削除（AWS関連）
# AWS_REGION=
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=

# 追加（Azure関連）
AZURE_COSMOS_ENDPOINT=https://...
AZURE_COSMOS_CONNECTION_STRING=...
AZURE_COSMOS_DATABASE_ID=remote-swe-agents
AZURE_COSMOS_CONTAINER_NAME=remote-swe-agents

AZURE_STORAGE_ACCOUNT_NAME=...
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER_NAME=images

AZURE_KEYVAULT_URL=https://...
```

## 📝 実装チェックリスト

### Phase 1: agent-core（基盤）

- [ ] `azure/cosmos.ts` - transactWrite実装
- [ ] `azure/cosmos.ts` - batchWrite実装
- [ ] `azure/blob-storage.ts` - writeBytesToKey実装
- [ ] `azure/blob-storage.ts` - getBytesFromKey実装
- [ ] `azure/index.ts` - エクスポート整理
- [ ] agent-coreのビルド確認

### Phase 2: webapp インポート修正

- [ ] `src/app/sessions/new/page.tsx`
- [ ] `src/app/sessions/new/actions.ts`
- [ ] `src/app/sessions/new/template-actions.ts`
- [ ] `src/app/sessions/(root)/page.tsx`
- [ ] `src/app/sessions/[workerId]/page.tsx`
- [ ] `src/app/sessions/[workerId]/actions.ts`
- [ ] `src/app/cost/page.tsx`
- [ ] `src/app/api-keys/page.tsx`
- [ ] `src/app/custom-agent/page.tsx`
- [ ] `src/app/preferences/page.tsx`

### Phase 3: Lambda → Functions

- [ ] `src/jobs/async-job-runner.ts`
- [ ] Azure Functions依存関係追加

### Phase 4: 検証

- [ ] webappのビルド成功
- [ ] TypeScriptエラーなし
- [ ] ローカル起動確認
- [ ] 基本機能の動作確認

## 🚀 実装順序（推奨）

1. **agent-core: Cosmos DB transactWrite実装** ← 最優先
2. **agent-core: Blob Storage S3互換API実装**
3. **agent-core: エクスポート整理**
4. **webapp: sessions/new/\* の修正** （3ファイル）
5. **webapp: sessions/[workerId]/\* の修正** （2ファイル）
6. **webapp: 他ページの修正** （cost, api-keys, etc.）
7. **webapp: async-job-runner修正**
8. **ビルド & 動作確認**

## ⏰ 見積もり

| Phase                   | 作業時間    | 難易度 |
| ----------------------- | ----------- | ------ |
| Phase 1: agent-core     | 2-3時間     | 中     |
| Phase 2: webapp imports | 1-2時間     | 低     |
| Phase 3: Functions      | 0.5-1時間   | 低     |
| Phase 4: 検証           | 1-2時間     | 中     |
| **合計**                | **4-8時間** | -      |

## 🎯 次のアクション

**今すぐ始めるべきこと:**

```bash
# 1. agent-coreに移動
cd packages/agent-core

# 2. azure/cosmos.ts を開いて transactWrite 実装
# 3. azure/blob-storage.ts を開いて S3互換API実装
# 4. azure/index.ts でエクスポート整理
```

では、**Phase 1のagent-core実装**から始めましょうか？
