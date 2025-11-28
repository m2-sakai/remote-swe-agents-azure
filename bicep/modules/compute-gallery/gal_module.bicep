targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('Compute Gallery の名前')
@minLength(1)
param galleryName string

@description('説明')
param galleryDescription string = 'Remote SWE Agents Worker Images'

resource gallery 'Microsoft.Compute/galleries@2024-03-03' = {
  name: galleryName
  location: location
  tags: tag
  properties: {
    description: galleryDescription
    identifier: {}
  }
}

output galleryId string = gallery.id
output galleryName string = gallery.name
