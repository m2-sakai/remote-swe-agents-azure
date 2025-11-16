targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('プライベートエンドポイントのリソース名')
@minLength(2)
@maxLength(64)
param privateEndpointName string

@description('プライベートリンクサービスのリソース ID')
param privateLinkServiceId string

@description('接続する必要があるリモートリソースから取得したグループのID')
param privateLinkServiceGroupIds array

@description('仮想ネットワークのリソース名')
param virtualNetworkName string

@description('仮想ネットワークのサブネット名')
@minLength(1)
@maxLength(80)
param subnetName string

@description('プライベートDNSゾーンの情報')
param privateDnsZoneName string

resource existingVirtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' existing = {
  name: virtualNetworkName
}

resource existingSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-10-01' existing = {
  parent: existingVirtualNetwork
  name: subnetName
}

resource existingPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' existing = {
  name: privateDnsZoneName
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-10-01' = {
  name: privateEndpointName
  location: location
  tags: tag
  properties: {
    privateLinkServiceConnections: [
      {
        name: privateEndpointName
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: privateLinkServiceGroupIds
          privateLinkServiceConnectionState: {
            status: 'Approved'
            actionsRequired: 'None'
          }
        }
      }
    ]
    manualPrivateLinkServiceConnections: []
    customNetworkInterfaceName: '${privateEndpointName}-nic'
    subnet: {
      id: existingSubnet.id
    }
    ipConfigurations: []
    customDnsConfigs: []
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-10-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: privateDnsZoneName
        properties: {
          privateDnsZoneId: existingPrivateDnsZone.id
        }
      }
    ]
  }
}

output privateEndpointId string = privateEndpoint.id
