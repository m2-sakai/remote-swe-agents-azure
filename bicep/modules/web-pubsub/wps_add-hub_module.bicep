targetScope = 'resourceGroup'

@description('WebPubSub のリソース名')
param webPubSubName string

@description('Hub のリソース名')
param hubName string

resource existingWebPubSub 'Microsoft.SignalRService/webPubSub@2025-01-01-preview' existing = {
  name: webPubSubName
}

resource wpsHub 'Microsoft.SignalRService/webPubSub/hubs@2025-01-01-preview' = {
  parent: existingWebPubSub
  name: hubName
  properties: {
    eventHandlers: []
    eventListeners: []
    anonymousConnectPolicy: 'Deny'
    webSocketKeepAliveIntervalInSeconds: 20
  }
}
