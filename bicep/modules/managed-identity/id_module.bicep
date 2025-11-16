targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('マネージドIDのリソース名')
@minLength(1)
param userAssignedIdentityName string

resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' = {
  name: userAssignedIdentityName
  location: location
  tags: tag
}

output userAssignedIdentityId string = userAssignedIdentity.id
output userAssignedIdentityClientId string = userAssignedIdentity.properties.clientId
output userAssignedIdentityPrincipalId string = userAssignedIdentity.properties.principalId
