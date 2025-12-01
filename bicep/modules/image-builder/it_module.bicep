targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Image Template の名前')
param imageTemplateName string

@description('User Assigned Identity のリソースID')
param userAssignedIdentityName string

@description('セットアップスクリプト')
param setupScript string

@description('Compute Gallery の名前')
param galleryName string

@description('Image Definition の名前')
param imageDefinitionName string

@description('Image Version')
param imageVersion string = '1.0.0'

@description('仮想ネットワークのリソース名')
@minLength(2)
@maxLength(64)
param virtualNetworkName string

@description('VM用サブネットの名前')
param subnetName string = ''

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource existingVirtualNetwork 'Microsoft.Network/virtualNetworks@2024-10-01' existing = {
  name: virtualNetworkName
}

resource imageTemplate 'Microsoft.VirtualMachineImages/imageTemplates@2024-02-01' = {
  name: imageTemplateName
  location: location
  tags: tag
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${existingUserAssignedIdentity.id}': {}
    }
  }
  properties: {
    buildTimeoutInMinutes: 60
    vmProfile: {
      vmSize: 'Standard_D2s_v3'
      osDiskSizeGB: 30
      vnetConfig: {
        subnetId: '${existingVirtualNetwork.id}/subnets/${subnetName}'
      }
    }
    source: {
      type: 'PlatformImage'
      publisher: 'Canonical'
      offer: 'ubuntu-24_04-lts'
      sku: 'server'
      version: 'latest'
    }
    customize: [
      {
        type: 'Shell'
        name: 'setup-worker'
        inline: [
          setupScript
        ]
      }
    ]
    distribute: [
      {
        type: 'SharedImage'
        galleryImageId: resourceId('Microsoft.Compute/galleries/images', galleryName, imageDefinitionName)
        runOutputName: '${imageTemplateName}-${imageVersion}'
        replicationRegions: [
          'japaneast'
        ]
        versioning: {
          scheme: 'Latest'
        }
        storageAccountType: 'Standard_LRS'
      }
    ]
  }
}

output imageTemplateId string = imageTemplate.id
output imageTemplateName string = imageTemplate.name
