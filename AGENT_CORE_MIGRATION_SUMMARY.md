# Agent Core Migration Summary

## Overview

agent-coreパッケージのAzure移行が完了しました。DynamoDB、S3、SSMの呼び出しをCosmos DB、Blob Storage、Key Vaultに変換しました。

## Migrated Files (9/11 core files)

### ✅ Complete Migrations

1. **sessions.ts**
   - Container: `sessions`
   - Functions: `getSession`, `getSessions`, `updateSession`
   - Pattern: Read-modify-replace for updates, query with ORDER BY

2. **api-key.ts**
   - Container: `api-keys`
   - Functions: `createApiKey`, `validateApiKey`, `getApiKeys`, `deleteApiKey`
   - Pattern: CRUD operations with 404 handling

3. **preferences.ts**
   - Container: `preferences`
   - Functions: `updatePreferences`, `getPreferences`
   - Pattern: Upsert with default fallback

4. **metadata.ts**
   - Container: `metadata`
   - Functions: `writeMetadata`, `readMetadata`
   - Pattern: Simple upsert and read with 404 handling

5. **prompt.ts**
   - Container: `config`
   - Functions: `readCommonPrompt`, `writeCommonPrompt`
   - Pattern: Global configuration storage

6. **custom-agent.ts**
   - Container: `custom-agents`
   - Functions: `getCustomAgent`, `getCustomAgents`, `createCustomAgent`, `updateCustomAgent`, `deleteCustomAgent`
   - Pattern: Full CRUD with validation and queries

7. **cost.ts**
   - Container: `token-usage`
   - Functions: `calculateTotalSessionCost`, `updateSessionCost`
   - Pattern: Query aggregation for cost calculation

8. **messages.ts**
   - Container: `messages`
   - Storage: Blob Storage for images
   - Functions: `saveConversationHistoryAtomic`, `saveConversationHistory`, `updateMessageTokenCount`, `getConversationHistory`
   - Pattern: Complex message handling with image storage in Blob Storage
   - Note: Uses sequential creates instead of transaction (Cosmos DB limitation)

9. **webapp-origin.ts**
   - Storage: Key Vault
   - Functions: `getWebappOrigin`, `getWebappSessionUrl`
   - Pattern: SSM Parameter Store → Key Vault secret retrieval
   - Environment: `WEBAPP_ORIGIN_SECRET_NAME` (changed from `WEBAPP_ORIGIN_NAME_PARAMETER`)

10. **converse.ts** (partial)
    - Container: `token-usage`
    - Functions: `trackTokenUsage` (migrated)
    - Pattern: Increment token counters with 404-safe upsert
    - Note: Bedrock client code unchanged (will be migrated to Azure OpenAI in later phase)

### ⏳ Deferred (Worker Phase)

11. **worker-manager.ts**
    - Dependencies: EC2, SSM
    - Will be migrated during Worker infrastructure phase (EC2 → Azure VM)

## Migration Patterns Used

### Cosmos DB Patterns

1. **Create Item**

```typescript
const container = getContainer(CONTAINER_NAME);
await container.items.create({
  id: `${PK}#${SK}`,
  PK,
  SK,
  ...data,
});
```

2. **Read Item**

```typescript
const container = getContainer(CONTAINER_NAME);
try {
  const { resource: item } = await container.item(id, PK).read();
  return item;
} catch (error: any) {
  if (error.code === 404) {
    return null;
  }
  throw error;
}
```

3. **Update Item (Read-Modify-Replace)**

```typescript
const { resource: existing } = await container.item(id, PK).read();
const updated = { ...existing, ...updates };
await container.item(id, PK).replace(updated);
```

4. **Delete Item**

```typescript
await container.item(id, PK).delete();
```

5. **Query Items**

```typescript
const querySpec = {
  query: 'SELECT * FROM c WHERE c.PK = @pk ORDER BY c.SK',
  parameters: [{ name: '@pk', value: PK }],
};
const { resources: items } = await container.items.query(querySpec).fetchAll();
```

### Blob Storage Pattern

```typescript
import { writeBytesToKey, getBytesFromKey } from './azure/blob-storage';

// Write
await writeBytesToKey(blobKey, bytes);

// Read
const bytes = await getBytesFromKey(blobKey);
```

### Key Vault Pattern

```typescript
import { getSecret } from './azure/keyvault';

const secretValue = await getSecret(secretName);
```

## Container Design

| Container Name | Partition Key             | Sort Key          | Purpose                  |
| -------------- | ------------------------- | ----------------- | ------------------------ |
| sessions       | PK: `session`             | SK: workerId      | Session metadata         |
| api-keys       | PK: `api-key`             | SK: keyHash       | API key management       |
| preferences    | PK: `global-preferences`  | SK: `preferences` | Global settings          |
| metadata       | PK: `metadata-{workerId}` | SK: tag           | Worker metadata          |
| config         | PK: `global-config`       | SK: `prompt`      | System configuration     |
| custom-agents  | PK: `custom-agent`        | SK: agentId       | Custom agent definitions |
| token-usage    | PK: `token-{workerId}`    | SK: modelId       | Token usage tracking     |
| messages       | PK: `message-{workerId}`  | SK: timestamp     | Conversation history     |

## Environment Variables

### Changed

- `WEBAPP_ORIGIN_NAME_PARAMETER` → `WEBAPP_ORIGIN_SECRET_NAME` (SSM → Key Vault)

### New Azure Variables

- `AZURE_COSMOS_ENDPOINT`
- `AZURE_COSMOS_DATABASE_NAME`
- `AZURE_STORAGE_ACCOUNT_NAME`
- `AZURE_STORAGE_CONTAINER_NAME`
- `AZURE_KEY_VAULT_URL`

## Known Limitations

1. **Transaction Support**
   - DynamoDB's `TransactWriteCommand` → Sequential creates in Cosmos DB
   - In `saveConversationHistoryAtomic`: Two separate `create()` calls
   - Consider using Cosmos DB stored procedures for true atomicity if needed

2. **Numeric ADD Operation**
   - DynamoDB's `ADD` expression → Read-modify-replace pattern
   - In `trackTokenUsage` and other increment operations

3. **Schema Type Errors**
   - Some TypeScript errors remain due to PK type definitions in schema files
   - `Type 'string' is not assignable to type '`message-${string}`'`
   - Will be fixed when updating schema definitions

## Next Steps

### Immediate

1. ✅ Install Azure SDK packages: `npm install` in packages/agent-core
2. ⏳ Update schema files to accommodate Cosmos DB `id` field requirements
3. ⏳ Test each migrated function with actual Azure resources

### Phase 2: Tools Migration

- `tools/send-image/index.ts` - S3 → Blob Storage
- `tools/create-pr/index.ts` - DynamoDB operations

### Phase 3: Worker Infrastructure

- `worker-manager.ts` - EC2 + SSM → Azure VM + Key Vault
- Worker deployment configuration

### Phase 4: LLM Migration

- `converse.ts` Bedrock client → Azure OpenAI
- Model configuration updates
- Token usage tracking compatibility

## Testing Checklist

- [ ] Session CRUD operations
- [ ] API key validation and management
- [ ] Preferences get/update
- [ ] Custom agent lifecycle
- [ ] Message history with image storage
- [ ] Cost calculation and token tracking
- [ ] Worker metadata operations
- [ ] Configuration management

## Files Modified

- ✅ packages/agent-core/src/lib/sessions.ts
- ✅ packages/agent-core/src/lib/api-key.ts
- ✅ packages/agent-core/src/lib/preferences.ts
- ✅ packages/agent-core/src/lib/metadata.ts
- ✅ packages/agent-core/src/lib/prompt.ts
- ✅ packages/agent-core/src/lib/custom-agent.ts
- ✅ packages/agent-core/src/lib/cost.ts
- ✅ packages/agent-core/src/lib/messages.ts
- ✅ packages/agent-core/src/lib/webapp-origin.ts
- ✅ packages/agent-core/src/lib/converse.ts (partial)
- ⏳ packages/agent-core/src/lib/worker-manager.ts (deferred)

## Deployment Notes

1. Create Cosmos DB containers with appropriate partition keys before deployment
2. Configure Azure Storage account and container
3. Set up Key Vault and store necessary secrets
4. Update all environment variables in deployment configuration
5. Run `npm install` to install Azure SDK dependencies
6. Build and deploy updated agent-core package

## Migration Completion: 9/11 files (82%)

Worker-specific file (worker-manager.ts) deferred to Worker infrastructure phase.
