targetScope = 'resourceGroup'

@description('対象のストレージアカウントID')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('割り当てるロールID')
param roleDefinitionId string = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Storage Blob Data Contributor

@description('対象のマネージドID')
param userAssignedIdentityName string

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource existingStorageAccount 'Microsoft.Storage/storageAccounts@2025-06-01' existing = {
  name: storageAccountName
}

resource storageAccountRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(userAssignedIdentityName, storageAccountName, roleDefinitionId, resourceGroup().id)
  scope: existingStorageAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: existingUserAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output storageAccountRoleAssignmentId string = storageAccountRoleAssignment.id
