targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Compute Gallery の名前')
@minLength(1)
param galleryName string = 'remotesweagents_worker_images'

@description('Image Definition の名前')
@minLength(1)
param imageDefinitionName string = 'workervm_image_definition'

@description('Image Definition の説明')
param imageDescription string = 'Worker VM with Node.js, Docker, and agent packages pre-installed'

@description('OS タイプ')
@allowed(['Linux', 'Windows'])
param osType string = 'Linux'

@description('OS の状態')
@allowed(['Generalized', 'Specialized'])
param osState string = 'Generalized'

@description('Hyper-V Generation')
@allowed(['V1', 'V2'])
param hyperVGeneration string = 'V2'

@description('Publisher')
param publisher string = 'RemoteSweAgents'

@description('Offer')
param offer string = 'WorkerVM'

@description('SKU')
param sku string = 'Ubuntu2204'

resource existingGallery 'Microsoft.Compute/galleries@2024-03-03' existing = {
  name: galleryName
}

resource imageDefinition 'Microsoft.Compute/galleries/images@2024-03-03' = {
  parent: existingGallery
  name: imageDefinitionName
  location: location
  tags: tag
  properties: {
    description: imageDescription
    osType: osType
    osState: osState
    hyperVGeneration: hyperVGeneration
    identifier: {
      publisher: publisher
      offer: offer
      sku: sku
    }
    recommended: {
      vCPUs: {
        min: 2
        max: 8
      }
      memory: {
        min: 4
        max: 32
      }
    }
    features: [
      {
        name: 'SecurityType'
        value: 'TrustedLaunch'
      }
    ]
  }
}

output imageDefinitionId string = imageDefinition.id
output imageDefinitionName string = imageDefinition.name
