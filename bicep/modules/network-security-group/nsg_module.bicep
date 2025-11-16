targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('ネットワークセキュリティグループのリソース名')
@minLength(1)
@maxLength(80)
param networkSecurityGroupName string

resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2024-10-01' = {
  name: networkSecurityGroupName
  location: location
  tags: tag
  properties: {
    securityRules: []
  }
}

output networkSecurityGroupId string = networkSecurityGroup.id
