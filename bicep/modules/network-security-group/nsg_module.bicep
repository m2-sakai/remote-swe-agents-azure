targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('ネットワークセキュリティグループのリソース名')
@minLength(1)
@maxLength(80)
param networkSecurityGroupName string

@description('適用するセキュリティルールの配列')
param securityRules array

resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2024-10-01' = {
  name: networkSecurityGroupName
  location: location
  tags: tag
  properties: {
    securityRules: securityRules
  }
}

output networkSecurityGroupId string = networkSecurityGroup.id
