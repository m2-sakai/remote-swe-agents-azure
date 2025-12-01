targetScope = 'resourceGroup'

@description('Cosmos DB のリソース名')
param cosmosDbName string

@description('データベース名')
param databaseName string

@description('コンテナ名')
param containerName string

@description('パーティションキーのパス (例: /PK)')
param partitionKeyPath string

resource existingCosmosDb 'Microsoft.DocumentDB/databaseAccounts@2025-10-15' existing = {
  name: cosmosDbName
}

resource existingDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2025-10-15' existing = {
  parent: existingCosmosDb
  name: databaseName
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2025-10-15' = {
  parent: existingDatabase
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [partitionKeyPath]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

output containerName string = container.name
