targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Key Vaultのリソース名')
@minLength(1)
param keyVaultName string

@description('SKU名')
param skuName string = 'standard'

@description('パブリックネットワークのアクセス許可')
param publicNetworkAccess string = 'Enabled'

@description('許可するIPアドレス')
param allowIpAddresses array = [
  '24.239.147.179/32'
  '24.239.147.180/32'
]

resource keyVault 'Microsoft.KeyVault/vaults@2025-05-01' = {
  name: keyVaultName
  location: location
  tags: tag
  properties: {
    sku: {
      family: 'A'
      name: skuName
    }
    enabledForDeployment: true
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: true
    enablePurgeProtection: true
    publicNetworkAccess: publicNetworkAccess
    tenantId: tenant().tenantId
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      ipRules: [
        for ip in allowIpAddresses: {
          value: ip
        }
      ]
    }
  }
}

output keyVaultId string = keyVault.id
