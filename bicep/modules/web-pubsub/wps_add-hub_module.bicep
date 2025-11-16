targetScope = 'resourceGroup'

@description('WebPubSub のリソース名')
param webPubSubName string

@description('Hub のリソース名')
param hubName string

@description('イベントハンドラーのURL')
param urlTemplate string

resource existingWebPubSub 'Microsoft.SignalRService/webPubSub@2025-01-01-preview' existing = {
  name: webPubSubName
}

resource wpsHub 'Microsoft.SignalRService/webPubSub/hubs@2025-01-01-preview' = {
  parent: existingWebPubSub
  name: hubName
  properties: {
    eventHandlers: [
      {
        urlTemplate: urlTemplate
        userEventPattern: '*'
        systemEvents: []
        auth: {
          type: 'None'
        }
      }
    ]
    eventListeners: []
    anonymousConnectPolicy: 'Deny'
    webSocketKeepAliveIntervalInSeconds: 20
  }
}
