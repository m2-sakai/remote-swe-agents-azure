targetScope = 'resourceGroup'

@description('マネージドIDのリソース名')
@minLength(3)
@maxLength(128)
param userAssignedIdentityName string

@description('マネージドIDに付与するロールID')
param roleDefinitionId string = 'b24988ac-6180-42a0-ab88-20f7382dd24c'

var roleAssignmentName = guid(userAssignedIdentityName,roleDefinitionId, resourceGroup().id)

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName
  scope: resourceGroup()
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: existingUserAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}
