targetScope = 'resourceGroup'

@description('Azure OpenAI アカウントのリソース名')
param openAIAccountName string

@description('デプロイメント名')
param deploymentName string

@description('モデル名')
@allowed([
  'gpt-4o'
])
param modelName string = 'gpt-4o'

@description('モデルバージョン')
param modelVersion string = '2024-11-20'

@description('モデルフォーマット')
@allowed(['OpenAI'])
param modelFormat string = 'OpenAI'

@description('SKU名')
@allowed(['Standard', 'GlobalStandard'])
param skuName string = 'Standard'

@description('容量（TPM: Tokens Per Minute in thousands）')
@minValue(1)
@maxValue(1000)
param capacity int = 50

resource existingOpenAIAccount 'Microsoft.CognitiveServices/accounts@2025-09-01' existing = {
  name: openAIAccountName
}

resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2025-09-01' = {
  name: deploymentName
  parent: existingOpenAIAccount
  sku: {
    name: skuName
    capacity: capacity
  }
  properties: {
    model: {
      format: modelFormat
      name: modelName
      version: modelVersion
    }
  }
}

output deploymentId string = deployment.id
output deploymentName string = deployment.name
