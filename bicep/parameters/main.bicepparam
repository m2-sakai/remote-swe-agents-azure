using '../templates/main.bicep'

// 共通
@description('タグ')
param tag = {
  owner: 'm2-sakai'
  project: 'remote-swe-agents-azure'
}

// マネージドID
param userAssignedIdentityName = 'm2-sakai-je-ID-01'

// Log Analytics / Application Insights
param logAnalyticsWorkspaceName = 'm2-sakai-je-LOGANA-01'
param applicationInsightsName = 'm2-sakai-je-APPINS-01'

// NSG
param networkSecurityGroups = []

// 仮想ネットワーク / サブネット
param virtualNetworkName = 'm2-sakai-je-VNET-01'
param addressPrefixes = ['172.16.0.0/16']
param subnets = []

// プライベートDNSゾーン
param privateDnsZones = []

// App Service Plan / App Service
param appServicePlanName = 'm2-sakai-je-ASP-01'
param appServicePlanSkuName = 'P0V3'
param appServiceName = 'm2-sakai-je-APP-01'
param runtimeStack = 'NODE|22-lts'
