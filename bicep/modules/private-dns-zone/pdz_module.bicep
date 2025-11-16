targetScope = 'resourceGroup'

@description('タグ')
param tag object = {}

@description('プライベートDNSゾーンのリソース名')
@minLength(1)
@maxLength(63)
param privateDnsZoneName string

@description('プライベートDNSゾーンに追加する仮想ネットワークリンク名')
@minLength(1)
@maxLength(80)
param privateDnsZoneVnetLinkName string

@description('仮想ネットワークのリソース名')
param virtualNetworkName string

resource existingVirtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' existing = {
  name: virtualNetworkName
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
  tags: tag
  properties: {}
}

resource privateDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDnsZone
  name: privateDnsZoneVnetLinkName
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: existingVirtualNetwork.id
    }
  }
}

output privateDnsZoneId string = privateDnsZone.id
