targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Azure OpenAI アカウントのリソース名')
@minLength(2)
@maxLength(64)
param openAIAccountName string

@description('SKU名')
@allowed(['S0'])
param skuName string = 'S0'

@description('Public Network Access')
@allowed(['Enabled', 'Disabled'])
param publicNetworkAccess string = 'Disabled'

resource openAIAccount 'Microsoft.CognitiveServices/accounts@2025-09-01' = {
  name: openAIAccountName
  location: location
  tags: tag
  kind: 'AIServices'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: openAIAccountName
    publicNetworkAccess: publicNetworkAccess
    networkAcls: {
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: []
    }
  }
}

output openAIAccountId string = openAIAccount.id
output openAIAccountEndpoint string = openAIAccount.properties.endpoint
output openAIAccountName string = openAIAccount.name
