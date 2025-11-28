targetScope = 'resourceGroup'

@description('ストレージアカウント Blob ストレージ用のリソース名')
@minLength(3)
@maxLength(24)
param storageAccountName string

@description('コンテナ名')
@minLength(3)
@maxLength(63)
param blobContainerName string

resource existingBlobService 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' existing = {
  name: '${storageAccountName}/default'
}

resource blobServiceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: existingBlobService
  name: blobContainerName
  properties: {
    immutableStorageWithVersioning: {
      enabled: false
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
    publicAccess: 'None'
  }
}

output blobServiceContainerId string = blobServiceContainer.id
