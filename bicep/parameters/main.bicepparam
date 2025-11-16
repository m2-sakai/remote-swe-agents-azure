using '../templates/main.bicep'

// パラメータ：共通
@description('タグ')
param tag = {
  owner: 'm2-sakai'
  project: 'remote-swe-agents-azure'
}

// パラメータ：マネージドID
param userAssignedIdentityName = 'm2-sakai-je-ID-01'

// パラメータ：Log Analytics
param logAnalyticsWorkspaceName = 'm2-sakai-je-LOGANA-01'

// パラメータ：Application Insights
param applicationInsightsName = 'm2-sakai-je-APPINS-01'

// パラメータ：App Service Plan
param appServicePlanName = 'm2-sakai-je-ASP-01'
param appServicePlanSkuName = 'P0V3'

// パラメータ：App Service
param appServiceName = 'm2-sakai-je-APP-01'
param runtimeStack = 'NODE|22-lts'
