targetScope = 'resourceGroup'

@description('KeyVaultのリソース名')
@minLength(1)
param keyVaultName string

@description('割り当てるロールID')
@minLength(1)
param roleDefinitionId string

@description('対象のマネージドIDのリソース名')
param userAssignedIdentityName string

@description('KeyVaultの情報')
resource existingKeyVault 'Microsoft.KeyVault/vaults@2025-05-01' existing = {
  name: keyVaultName
}

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(userAssignedIdentityName, keyVaultName, roleDefinitionId, resourceGroup().id)
  scope: existingKeyVault
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: existingUserAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultRoleAssignmentId string = keyVaultRoleAssignment.id
