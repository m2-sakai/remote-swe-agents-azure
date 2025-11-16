targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('App Service の名前')
@minLength(1)
param appServiceName string

@description('仮想ネットワークの名前')
param virtualNetworkName string

@description('サブネットの名前')
param subnetName string

resource existingVirtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' existing = {
  name: virtualNetworkName
}

resource existingAppService 'Microsoft.Web/sites@2024-11-01' existing = {
  name: appServiceName
}

resource appServiceVnetIntegrationConfig 'Microsoft.Web/sites@2024-11-01' = {
  name: appServiceName
  location: location
  properties: {
    virtualNetworkSubnetId: '${existingVirtualNetwork.id}/subnets/${subnetName}'
  }
}

resource appServiceVnetIntegration 'Microsoft.Web/sites/virtualNetworkConnections@2024-04-01' = {
  name: '${virtualNetworkName}_${subnetName}'
  parent: existingAppService
  properties: {
    vnetResourceId: '${existingVirtualNetwork.id}/subnets/${subnetName}'
    isSwift: true
  }
}

output appServiceVnetIntegrationId string = appServiceVnetIntegration.id
