targetScope = 'resourceGroup'

// 共通
@description('リージョン')
param location string = resourceGroup().location
@description('タグ')
param tag object = {}

// マネージドID
@description('マネージドIDのリソース名')
@minLength(3)
@maxLength(128)
param userAssignedIdentityName string
module managedIdentityModule '../modules/managed-identity/id_module.bicep' = {
  name: take(userAssignedIdentityName, 64)
  params: {
    tag: tag
    userAssignedIdentityName: userAssignedIdentityName
  }
}
module managedIdentityAddRoleModule '../modules/managed-identity/id_add-role_module.bicep' = {
  name: '${take(userAssignedIdentityName, 40)}_AddRole'
  params: {
    userAssignedIdentityName: userAssignedIdentityName
  }
  dependsOn: [
    managedIdentityModule
  ]
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
      privateLinkServiceNetworkPolicies: subnet.privateLinkServiceNetworkPolicies
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

// Key Vault
@description('Key Vaultのリソース名')
@minLength(1)
param keyVaultName string
@description('Key Vault用プライベートエンドポイントのリソース名')
@minLength(2)
@maxLength(64)
param kvPrivateEndpointName string
@description('Key Vault用接続する必要があるリモートリソースから取得したグループのID')
param kvPrivateLinkServiceGroupIds array
@description('Key Vault用仮想ネットワークのサブネット名')
@minLength(1)
@maxLength(80)
param kvPrivateEndpointSubnetName string
@description('Key Vault用プライベートDNSゾーンの情報')
param kvPrivateDnsZoneName string
@description('割り当てるロールID')
@minLength(1)
param kvRoleDefinitionId string
module kvModule '../modules/key-vault/kv_module.bicep' = {
  name: take(keyVaultName, 64)
  params: {
    tag: tag
    keyVaultName: keyVaultName
  }
  dependsOn: []
}
module kvDbPrivateEndpointModule '../modules/private-endpoint/pep_module.bicep' = {
  name: take(kvPrivateEndpointName, 64)
  params: {
    tag: tag
    privateEndpointName: kvPrivateEndpointName
    privateLinkServiceId: kvModule.outputs.keyVaultId
    privateLinkServiceGroupIds: kvPrivateLinkServiceGroupIds
    virtualNetworkName: virtualNetworkName
    subnetName: kvPrivateEndpointSubnetName
    privateDnsZoneName: kvPrivateDnsZoneName
  }
  dependsOn: [
    virtualNetworkModule
    pdzModule
  ]
}
module kvAddRoleModule '../modules/key-vault/kv_add-role_module.bicep' = {
  name: '${take(keyVaultName, 40)}_AddRole'
  params: {
    keyVaultName: keyVaultName
    roleDefinitionId: kvRoleDefinitionId
    userAssignedIdentityName: userAssignedIdentityName
  }
  dependsOn: [
    kvModule
    managedIdentityModule
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

// Storage Account
@description('Storage Accountの名前')
@minLength(3)
@maxLength(24)
param storageAccountName string
@description('Storage Account用プライベートエンドポイントのリソース名')
@minLength(2)
@maxLength(64)
param storageAccountPrivateEndpointName string
@description('Storage Account用接続する必要があるリモートリソースから取得したグループのID')
param storageAccountPrivateLinkServiceGroupIds array
@description('Storage Account用仮想ネットワークのサブネット名')
@minLength(1)
@maxLength(80)
param storageAccountPrivateEndpointSubnetName string
@description('Storage Account用プライベートDNSゾーンの情報')
param storageAccountPrivateDnsZoneName string
module storageAccountModule '../modules/storage-account/st_module.bicep' = {
  name: take(storageAccountName, 64)
  params: {
    tag: tag
    storageAccountName: storageAccountName
  }
  dependsOn: []
}
module storageAccountPrivateEndpointModule '../modules/private-endpoint/pep_module.bicep' = {
  name: take(storageAccountPrivateEndpointName, 64)
  params: {
    tag: tag
    privateEndpointName: storageAccountPrivateEndpointName
    privateLinkServiceId: storageAccountModule.outputs.storageAccountId
    privateLinkServiceGroupIds: storageAccountPrivateLinkServiceGroupIds
    virtualNetworkName: virtualNetworkName
    subnetName: storageAccountPrivateEndpointSubnetName
    privateDnsZoneName: storageAccountPrivateDnsZoneName
  }
  dependsOn: [
    virtualNetworkModule
    pdzModule
  ]
}
module storageAccountAddRoleModule '../modules/storage-account/st_add-role_module.bicep' = {
  name: '${take(storageAccountName, 40)}_AddRole'
  params: {
    storageAccountName: storageAccountName
    userAssignedIdentityName: userAssignedIdentityName
  }
  dependsOn: [
    storageAccountModule
    managedIdentityModule
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
    tag: tag
    cosmosDbName: cosmosDbName
  }
}
module cosmosDbPrivateEndpointModule '../modules/private-endpoint/pep_module.bicep' = {
  name: take(cosmosPrivateEndpointName, 64)
  params: {
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
module cosmosAddRoleModule '../modules/cosmos-db/cosmos_add-role_module.bicep' = {
  name: '${take(cosmosDbName, 40)}_AddRole'
  params: {
    cosmosDbName: cosmosDbName
    userAssignedIdentityName: userAssignedIdentityName
  }
  dependsOn: [
    cosmosDbModule
    managedIdentityModule
  ]
}

// Azure OpenAI
@description('Azure OpenAI アカウントのリソース名')
@minLength(2)
@maxLength(64)
param openAIAccountName string
@description('Azure OpenAI用プライベートエンドポイントのリソース名')
@minLength(2)
@maxLength(64)
param openAIPrivateEndpointName string
@description('Azure OpenAI用接続する必要があるリモートリソースから取得したグループのID')
param openAIPrivateLinkServiceGroupIds array
@description('Azure OpenAI用仮想ネットワークのサブネット名')
@minLength(1)
@maxLength(80)
param openAIPrivateEndpointSubnetName string
@description('Azure OpenAI用プライベートDNSゾーンの情報')
param openAIPrivateDnsZoneName string
module openAIModule '../modules/cognitive-services/cs_module.bicep' = {
  name: take(openAIAccountName, 64)
  params: {
    tag: tag
    openAIAccountName: openAIAccountName
  }
  dependsOn: []
}
module openAIPrivateEndpointModule '../modules/private-endpoint/pep_module.bicep' = {
  name: take(openAIPrivateEndpointName, 64)
  params: {
    tag: tag
    privateEndpointName: openAIPrivateEndpointName
    privateLinkServiceId: openAIModule.outputs.openAIAccountId
    privateLinkServiceGroupIds: openAIPrivateLinkServiceGroupIds
    virtualNetworkName: virtualNetworkName
    subnetName: openAIPrivateEndpointSubnetName
    privateDnsZoneName: openAIPrivateDnsZoneName
  }
  dependsOn: [
    virtualNetworkModule
    pdzModule
  ]
}
module openAIDeploymentModule '../modules/cognitive-services/cs_add-deployment_module.bicep' = {
  name: 'gpt-4o-deployment'
  params: {
    openAIAccountName: openAIAccountName
    deploymentName: 'gpt-4o'
  }
  dependsOn: [
    openAIModule
  ]
}
module openAIAddRoleModule '../modules/cognitive-services/cs_add-role_module.bicep' = {
  name: '${take(openAIAccountName, 40)}_AddRole'
  params: {
    openAIAccountName: openAIAccountName
    userAssignedIdentityName: userAssignedIdentityName
  }
  dependsOn: [
    openAIModule
    managedIdentityModule
  ]
}

// Gallery
@description('Compute Gallery の名前')
@minLength(1)
param galleryName string
@description('Compute Gallery の説明')
param galleryDescription string
@description('Image Definition の名前')
@minLength(1)
param imageDefinitionName string
@description('Image Definition の説明')
param imageDescription string = 'Worker VM with Node.js, Docker, and agent packages pre-installed'
module galleryModule '../modules/compute-gallery/gal_module.bicep' = {
  name: take(galleryName, 64)
  params: {
    galleryName: galleryName
    galleryDescription: galleryDescription
  }
  dependsOn: []
}
module galleryAddImageDefinitionModule '../modules/compute-gallery/gal_add-image-definition_module.bicep' = {
  name: take(imageDefinitionName, 64)
  params: {
    galleryName: galleryName
    imageDefinitionName: imageDefinitionName
    imageDescription: imageDescription
  }
  dependsOn: [
    galleryModule
  ]
}

// Image Builder
@description('Image Template の名前')
@minLength(1)
param imageTemplateName string = 'worker-template'
@description('Image Version')
param imageVersion string = '1.0.0'
@description('VM用サブネットの名前')
param vmSubnetName string
@description('セットアップスクリプト')
param setupScript string

module imageTemplateModule '../modules/image-builder/it_module.bicep' = {
  name: take(imageTemplateName, 64)
  params: {
    location: location
    tag: tag
    imageTemplateName: imageTemplateName
    userAssignedIdentityName: userAssignedIdentityName
    setupScript: setupScript
    galleryName: galleryName
    imageDefinitionName: imageDefinitionName
    imageVersion: imageVersion
    virtualNetworkName: virtualNetworkName
    subnetName: vmSubnetName
  }
  dependsOn: [
    managedIdentityAddRoleModule
    galleryAddImageDefinitionModule
  ]
}
