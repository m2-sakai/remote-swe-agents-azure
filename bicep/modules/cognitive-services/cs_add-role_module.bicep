targetScope = 'resourceGroup'

@description('Azure OpenAI アカウントのリソース名')
param openAIAccountName string

@description('マネージドIDのリソース名')
param userAssignedIdentityName string

@description('割り当てるロールID')
param roleDefinitionId string = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource existingOpenAIAccount 'Microsoft.CognitiveServices/accounts@2025-09-01' existing = {
  name: openAIAccountName
}

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: userAssignedIdentityName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(userAssignedIdentityName, openAIAccountName, roleDefinitionId, resourceGroup().id)
  scope: existingOpenAIAccount
  properties: {
    roleDefinitionId: resourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: existingUserAssignedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = roleAssignment.id
