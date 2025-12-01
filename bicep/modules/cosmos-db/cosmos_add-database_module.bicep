targetScope = 'resourceGroup'

@description('Cosmos DB のリソース名')
param cosmosDbName string

@description('データベース名')
param databaseName string

resource existingCosmosDb 'Microsoft.DocumentDB/databaseAccounts@2025-10-15' existing = {
  name: cosmosDbName
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2025-10-15' = {
  parent: existingCosmosDb
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

output databaseName string = database.name
