targetScope = 'resourceGroup'

// パラメータ：共通
@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

// パラメータ：マネージドID
@description('マネージドIDのリソース名')
@minLength(1)
param userAssignedIdentityName string

// パラメータ：Log Analytics
@description('Log Analytics ワークスペースの名前')
@minLength(4)
param logAnalyticsWorkspaceName string

// パラメータ：Application Insights
@description('Application Insights のリソース名')
@minLength(1)
@maxLength(260)
param applicationInsightsName string

// パラメータ：App Service Plan
@description('App Service Plan の名前')
@minLength(1)
param appServicePlanName string

@description('App Service Plan の SKU')
param appServicePlanSkuName string

// パラメータ：App Service
@description('App Service の名前')
@minLength(1)
param appServiceName string

@description('リソースの種類')
param appKind string = 'app,linux'

@description('App Service のランタイムスタック')
param runtimeStack string

// モジュール：マネージドID
module managedIdentityModule '../modules/managed-identity/id_module.bicep' = {
  name: 'managedIdentityModule'
  params: {
    location: location
    tag: tag
    userAssignedIdentityName: userAssignedIdentityName
  }
}

// モジュール：Log Analytics
module logAnalyticsModule '../modules/log-analytics/log_module.bicep' = {
  name: 'logAnalyticsModule'
  params: {
    location: location
    tag: tag
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
  }
}

// モジュール：Application Insights
module applicationInsightsModule '../modules/application-insights/appi_module.bicep' = {
  name: 'applicationInsightsModule'
  params: {
    location: location
    tag: tag
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    applicationInsightsName: applicationInsightsName
  }
  dependsOn: [
    logAnalyticsModule
  ]
}

// モジュール：App Service Plan
module appServicePlanModule '../modules/app-service-plan/asp_module.bicep' = {
  name: 'appServicePlanModule'
  params: {
    location: location
    tag: tag
    appServicePlanName: appServicePlanName
    skuName: appServicePlanSkuName
  }
}

// モジュール：App Service
module appServiceModule '../modules/app-service/app_module.bicep' = {
  name: 'appServiceModule'
  params: {
    appServiceName: appServiceName
    appServicePlanName: appServicePlanName
    kind: appKind
    userAssignedIdentityName: userAssignedIdentityName
    applicationInsightsName: applicationInsightsName
    runtimeStack: runtimeStack
  }
  dependsOn: [
    managedIdentityModule
    applicationInsightsModule
    appServicePlanModule
  ]
}
