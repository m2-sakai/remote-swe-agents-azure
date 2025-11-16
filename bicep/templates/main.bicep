targetScope = 'resourceGroup'

// 共通
@description('リージョン')
param location string = resourceGroup().location
@description('タグ')
param tag object = {}

// マネージドID
@description('マネージドIDのリソース名')
@minLength(1)
param userAssignedIdentityName string
module managedIdentityModule '../modules/managed-identity/id_module.bicep' = {
  name: take(userAssignedIdentityName, 64)
  params: {
    tag: tag
    userAssignedIdentityName: userAssignedIdentityName
  }
}

// Log Analytics / Application Insights
@description('Log Analytics ワークスペースの名前')
@minLength(4)
param logAnalyticsWorkspaceName string
@description('Application Insights のリソース名')
@minLength(1)
@maxLength(260)
param applicationInsightsName string
module logAnalyticsModule '../modules/log-analytics/log_module.bicep' = {
  name: take(logAnalyticsWorkspaceName, 64)
  params: {
    tag: tag
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
  }
}
module applicationInsightsModule '../modules/application-insights/appi_module.bicep' = {
  name: take(applicationInsightsName, 64)
  params: {
    tag: tag
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    applicationInsightsName: applicationInsightsName
  }
  dependsOn: [
    logAnalyticsModule
  ]
}

// NSG
@description('ネットワークセキュリティグループのリスト')
param networkSecurityGroups array
module networkSecurityGroupModule '../modules/network-security-group/nsg_module.bicep' = [
  for nsg in networkSecurityGroups: {
    name: take(nsg.networkSecurityGroupName, 64)
    params: {
      tag: tag
      networkSecurityGroupName: nsg.networkSecurityGroupName
      securityRules: nsg.securityRules
    }
    dependsOn: []
  }
]

// 仮想ネットワーク / サブネット
@description('仮想ネットワークのリソース名')
@minLength(2)
@maxLength(64)
param virtualNetworkName string
@description('CIDR 表記でこの仮想ネットワーク用に予約されているアドレスブロックの一覧')
param addressPrefixes string[]
@description('サブネットのリスト')
param subnets array
module virtualNetworkModule '../modules/virtual-network/vnet_module.bicep' = {
  name: take(virtualNetworkName, 64)
  params: {
    tag: tag
    virtualNetworkName: virtualNetworkName
    addressPrefixes: addressPrefixes
  }
  dependsOn: [
    networkSecurityGroupModule
  ]
}
@batchSize(1)
module subnetModules '../modules/virtual-network/vnet_add-subnet_module.bicep' = [
  for subnet in subnets: {
    name: '${take(virtualNetworkName, 40)}_${take(subnet.subnetName, 20)}'
    params: {
      subnetName: subnet.subnetName
      virtualNetworkName: virtualNetworkName
      addressPrefix: subnet.addressPrefix
      networkSecurityGroupName: subnet.networkSecurityGroupName
      serviceEndpoints: subnet.serviceEndpoints
      delegations: subnet.delegations
    }
    dependsOn: [
      virtualNetworkModule
    ]
  }
]

// プライベートDNSゾーン
@description('プライベートDNSゾーンのリスト')
param privateDnsZones array
module pdzModule '../modules/private-dns-zone/pdz_module.bicep' = [
  for pdz in privateDnsZones: {
    name: take(pdz.privateDnsZoneName, 64)
    params: {
      tag: tag
      privateDnsZoneName: pdz.privateDnsZoneName
      privateDnsZoneVnetLinkName: pdz.privateDnsZoneVnetLinkName
      virtualNetworkName: virtualNetworkName
    }
    dependsOn: [
      virtualNetworkModule
    ]
  }
]

// App Service Plan / App Service
@description('App Service Plan の名前')
@minLength(1)
param appServicePlanName string
@description('App Service Plan の SKU')
param appServicePlanSkuName string
@description('App Service の名前')
@minLength(1)
param appServiceName string
@description('リソースの種類')
param appKind string = 'app,linux'
@description('App Service のランタイムスタック')
param runtimeStack string
module appServicePlanModule '../modules/app-service-plan/asp_module.bicep' = {
  name: 'appServicePlanModule'
  params: {
    location: location
    tag: tag
    appServicePlanName: appServicePlanName
    skuName: appServicePlanSkuName
  }
}
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
    subnetModules
  ]
}
