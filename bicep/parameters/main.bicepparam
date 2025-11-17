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
param networkSecurityGroups = [
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Outbound-sub-0_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-PubSub-sub-1_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Cosmos-sub-2_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-OpenAI-sub-3_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-KV-sub-4_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Storage-sub-5_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Vm-sub-6_0'
    securityRules: []
  }
]

// 仮想ネットワーク / サブネット
param virtualNetworkName = 'm2-sakai-je-VNET-01'
param addressPrefixes = ['172.16.0.0/16']
param subnets = [
  {
    subnetName: 'Outbound-sub-0_0'
    addressPrefix: '172.16.0.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Outbound-sub-0_0'
    serviceEndpoints: []
    delegations: [
      {
        name: 'Microsoft.Web/serverFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
        type: 'Microsoft.Network/virtualNetworks/subnets/delegations'
      }
    ]
  }
  {
    subnetName: 'PubSub-sub-1_0'
    addressPrefix: '172.16.1.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-PubSub-sub-1_0'
    serviceEndpoints: []
    delegations: []
  }
  {
    subnetName: 'Cosmos-sub-2_0'
    addressPrefix: '172.16.2.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Cosmos-sub-2_0'
    serviceEndpoints: []
    delegations: []
  }
  {
    subnetName: 'OpenAI-sub-3_0'
    addressPrefix: '172.16.3.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-OpenAI-sub-3_0'
    serviceEndpoints: []
    delegations: []
  }
  {
    subnetName: 'KV-sub-4_0'
    addressPrefix: '172.16.4.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-KV-sub-4_0'
    serviceEndpoints: []
    delegations: []
  }
  {
    subnetName: 'Storage-sub-5_0'
    addressPrefix: '172.16.5.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Storage-sub-5_0'
    serviceEndpoints: []
    delegations: []
  }
  {
    subnetName: 'Vm-sub-6_0'
    addressPrefix: '172.16.6.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Vm-sub-6_0'
    serviceEndpoints: []
    delegations: []
  }
]

// プライベートDNSゾーン
param privateDnsZones = [
  {
    privateDnsZoneName: 'privatelink.openai.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.documents.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.webpubsub.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.blob.core.windows.net'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.vaultcore.azure.net'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.azurecr.io'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
]

// コンテナーレジストリ
param containerRegistryName = 'm2sakaijeacr01'
param skuName = 'Basic'

// App Service Plan / App Service
param appServicePlanName = 'm2-sakai-je-ASP-01'
param appServicePlanSkuName = 'P0V3'
param appServiceName = 'm2-sakai-je-APP-01'
param runtimeStack = 'DOCKER|${containerRegistryName}.azurecr.io/remote-swe-agent-azure-webapp:latest'
param vnetIntegrationSubnetName = 'Outbound-sub-0_0'
param aplAppSettings = [
  {
    name: 'SKIP_AUTH'
    value: 'true'
  }
  {
    name: 'DEV_USER_ID'
    value: 'dev-user-001'
  }
  {
    name: 'DEV_USER_EMAIL'
    value: 'dev@example.com'
  }
  {
    name: 'APP_ORIGIN'
    value: 'https://${appServiceName}.azurewebsites.net'
  }
  {
    name: 'PORT'
    value: '3000'
  }
]

// Cosmos DB
param cosmosDbName = 'm2-sakai-je-cosmos-01'
param cosmosPrivateEndpointName = 'm2-sakai-je-PEP-COSMOS-01'
param cosmosPrivateLinkServiceGroupIds = [
  'Sql'
]
param cosmosPrivateEndpointSubnetName = 'Cosmos-sub-2_0'
param cosmosPrivateDnsZoneName = 'privatelink.documents.azure.com'
