targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Log Analytics ワークスペースの名前')
param logAnalyticsWorkspaceName string

@description('Application Insights のリソース名')
@minLength(1)
@maxLength(260)
param applicationInsightsName string

resource existingLogAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2025-02-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tag
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
    WorkspaceResourceId: existingLogAnalyticsWorkspace.id
  }
}

output applicationInsightsId string = applicationInsights.id
