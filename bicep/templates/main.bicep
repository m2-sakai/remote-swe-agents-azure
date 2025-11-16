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

// Container Registry
@description('コンテナーレジストリのリソース名')
@minLength(5)
@maxLength(50)
param containerRegistryName string
@description('コンテナーレジストリのSKU名')
param skuName string
module containerRegistryModule '../modules/container-registy/cr_module.bicep' = {
  name: take(containerRegistryName, 64)
  params: {
    tag: tag
    containerRegistryName: containerRegistryName
    skuName: skuName
  }
  dependsOn: [
    pdzModule
  ]
}

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
@description('Vnet統合のサブネットの名前')
param vnetIntegrationSubnetName string
@description('アプリ観点のアプリケーション設定')
param aplAppSettings array
module appServicePlanModule '../modules/app-service-plan/asp_module.bicep' = {
  name: take(appServicePlanName, 64)
  params: {
    location: location
    tag: tag
    appServicePlanName: appServicePlanName
    skuName: appServicePlanSkuName
  }
}
module appServiceModule '../modules/app-service/app_module.bicep' = {
  name: take(appServiceName, 64)
  params: {
    appServiceName: appServiceName
    appServicePlanName: appServicePlanName
    kind: appKind
    userAssignedIdentityName: userAssignedIdentityName
    applicationInsightsName: applicationInsightsName
    runtimeStack: runtimeStack
    aplAppSettings: aplAppSettings
  }
  dependsOn: [
    managedIdentityModule
    applicationInsightsModule
    appServicePlanModule
    subnetModules
  ]
}
module appServiceVnetIntegrationModule '../modules/app-service/app_add-vnet-integration_module.bicep' = {
  name: '${take(appServiceName, 40)}_VnetIntegration'
  params: {
    appServiceName: appServiceName
    virtualNetworkName: virtualNetworkName
    subnetName: vnetIntegrationSubnetName
  }
  dependsOn: [
    appServiceModule
    virtualNetworkModule
  ]
}

// Cosmos DB
@description('Cosmos DB のリソース名')
@minLength(1)
param cosmosDbName string
@description('Cosmos DB用プライベートエンドポイントのリソース名')
@minLength(2)
@maxLength(64)
param cosmosPrivateEndpointName string
@description('Cosmos DB用接続する必要があるリモートリソースから取得したグループのID')
param cosmosPrivateLinkServiceGroupIds array
@description('Cosmos DB用仮想ネットワークのサブネット名')
@minLength(1)
@maxLength(80)
param cosmosPrivateEndpointSubnetName string
@description('Cosmos DB用プライベートDNSゾーンの情報')
param cosmosPrivateDnsZoneName string
module cosmosDbModule '../modules/cosmos-db/cosmos_module.bicep' = {
  name: take(cosmosDbName, 64)
  params: {
    location: location
    tag: tag
    cosmosDbName: cosmosDbName
  }
}
module cosmosDbPrivateEndpointModule '../modules/private-endpoint/pep_module.bicep' = {
  name: take(cosmosPrivateEndpointName, 64)
  params: {
    location: location
    tag: tag
    privateEndpointName: cosmosPrivateEndpointName
    privateLinkServiceId: cosmosDbModule.outputs.cosmosDbId
    privateLinkServiceGroupIds: cosmosPrivateLinkServiceGroupIds
    virtualNetworkName: virtualNetworkName
    subnetName: cosmosPrivateEndpointSubnetName
    privateDnsZoneName: cosmosPrivateDnsZoneName
  }
  dependsOn: [
    virtualNetworkModule
    pdzModule
  ]
}
