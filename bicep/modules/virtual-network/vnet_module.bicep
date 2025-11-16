targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('仮想ネットワークのリソース名')
@minLength(2)
@maxLength(64)
param virtualNetworkName string
@description('CIDR 表記でこの仮想ネットワーク用に予約されているアドレスブロックの一覧')
param addressPrefixes string[]

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' = {
  name: virtualNetworkName
  location: location
  tags: tag
  properties: {
    addressSpace: {
      addressPrefixes: addressPrefixes
    }
    encryption: {
      enabled: false
      enforcement: 'AllowUnencrypted'
    }
    subnets: []
    virtualNetworkPeerings: []
    enableDdosProtection: false
  }
}

output virtualNetworkId string = virtualNetwork.id
