targetScope = 'resourceGroup'

@description('Cosmos DB のリソース名')
param cosmosDbName string

@description('マネージドIDのリソース名')
@minLength(3)
@maxLength(128)
param userAssignedIdentityName string

@description('マネージドIDに付与するロールID')
param roleDefinitionId string = '00000000-0000-0000-0000-000000000002'

var roleAssignmentName = guid(userAssignedIdentityName,roleDefinitionId, resourceGroup().id)

resource existingCosmosDb 'Microsoft.DocumentDB/databaseAccounts@2025-05-01-preview' existing =  {
  name: cosmosDbName
}

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2025-05-01-preview' = {
  name: roleAssignmentName
  parent: existingCosmosDb
  properties: {
    roleDefinitionId: '/${subscription().id}/resourceGroups/${resourceGroup().name}/providers/Microsoft.DocumentDB/databaseAccounts/${cosmosDbName}/sqlRoleDefinitions/${roleDefinitionId}'
    principalId: existingUserAssignedIdentity.properties.principalId
    scope: existingCosmosDb.id
  }
}
