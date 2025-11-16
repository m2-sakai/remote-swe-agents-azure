targetScope = 'resourceGroup'

@description('タグ')
param tag object = {}

@description('プライベートDNSゾーンのリソース名')
@minLength(1)
@maxLength(63)
param privateDnsZoneName string

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
  tags: tag
  properties: {}
}

output privateDnsZoneId string = privateDnsZone.id
