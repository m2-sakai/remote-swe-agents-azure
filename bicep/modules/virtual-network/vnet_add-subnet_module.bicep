targetScope = 'resourceGroup'

@description('仮想ネットワークのリソース名')
@minLength(2)
@maxLength(64)
param virtualNetworkName string

@description('仮想ネットワークに割り当てるサブネット名')
@minLength(1)
@maxLength(80)
param subnetName string

@description('サブネットのアドレスプレフィックス')
param addressPrefix string

@description('サービスエンドポイントの配列')
param serviceEndpoints array = []

@description('デリゲートするリソースの配列')
param delegations array = []

@description('サブネットに適用するネットワークセキュリティグループのリソース名')
@minLength(1)
@maxLength(80)
param networkSecurityGroupName string = 'null'

resource existingVirtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' existing = {
  name: virtualNetworkName
}

resource existingNetworkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2024-10-01' existing = {
  name: networkSecurityGroupName
}

resource subnet 'Microsoft.Network/virtualNetworks/subnets@2024-10-01' = {
  name: subnetName
  parent: existingVirtualNetwork
  properties: {
    addressPrefix: addressPrefix
    networkSecurityGroup: {
      id: existingNetworkSecurityGroup.id
    }
    routeTable: null
    serviceEndpoints: serviceEndpoints
    delegations: delegations
    privateEndpointNetworkPolicies: 'Enabled'
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
}

output subnetId string = subnet.id
