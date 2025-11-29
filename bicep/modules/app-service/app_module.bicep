targetScope = 'resourceGroup'

@description('リージョン')
param location string = resourceGroup().location

@description('タグ')
param tag object = {}

@description('App Service の名前')
@minLength(1)
param appServiceName string

@description('App Service Plan の名前')
@minLength(1)
param appServicePlanName string

@description('リソースの種類')
param kind string = 'app,linux,container'

@description('ユーザー割り当てマネージドIDの名前')
param userAssignedIdentityName string

@description('Application Insightsの名前')
param applicationInsightsName string

@description('App Service のランタイムスタック')
param runtimeStack string

@description('アプリ観点のアプリケーション設定')
param aplAppSettings array = []

@description('基盤観点のアプリケーション設定')
param infraAppSettings array = []

@description('パブリックネットワークのアクセス許可')
param publicNetworkAccess string = 'Enabled'

@description('IP制限のルール')
param ipSecurityRestrictions array = [
  {
    ipAddress: '24.239.147.179/32'
    action: 'Allow'
    priority: 100
    name: 'Allow From NRI 1'
    description: 'Allow From NRI 1'
  }
  {
    ipAddress: '24.239.147.180/32'
    action: 'Allow'
    priority: 101
    name: 'Allow From NRI 2'
    description: 'Allow From NRI 2'
  }
]

@description('SCMのIP制限のルール')
param scmIpSecurityRestrictions array = []

resource existingUserAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2025-01-31-preview' existing = {
  name: userAssignedIdentityName
}

resource existingApplicationInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

resource existingAppServicePlan 'Microsoft.Web/serverfarms@2024-11-01' existing = {
  name: appServicePlanName
}

resource appService 'Microsoft.Web/sites@2024-11-01' = {
  name: appServiceName
  location: location
  tags: tag
  kind: kind
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${existingUserAssignedIdentity.id}': {}
    }
  }
  properties: {
    enabled: true
    hostNameSslStates: [
      {
        name: '${appServiceName}.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Standard'
      }
      {
        name: '${appServiceName}.scm.azurewebsites.net'
        sslState: 'Disabled'
        hostType: 'Repository'
      }
    ]
    serverFarmId: existingAppServicePlan.id
    reserved: true
    isXenon: false
    hyperV: false
    dnsConfiguration: {}
    siteConfig: {
      numberOfWorkers: 1
      linuxFxVersion: runtimeStack
      windowsFxVersion: ''
      appSettings: concat(
        [
          {
            name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
            value: existingApplicationInsights.properties.ConnectionString
          }
          {
            name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
            value: '~3'
          }
          {
            name: 'AZURE_CLIENT_ID'
            value: existingUserAssignedIdentity.properties.clientId
          }
          {
            name: 'AZURE_RESOURCE_GROUP_NAME'
            value: resourceGroup().name
          }
          {
            name: 'XDT_MicrosoftApplicationInsights_Mode'
            value: 'Recommended'
          }
        ],
        aplAppSettings,
        infraAppSettings
      )
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: existingUserAssignedIdentity.properties.clientId
      alwaysOn: false
      http20Enabled: true
      functionAppScaleLimit: 0
      minimumElasticInstanceCount: 1
      keyVaultReferenceIdentity: existingUserAssignedIdentity.id
      defaultDocuments: [
        'Default.htm'
        'Default.html'
        'Default.asp'
        'index.htm'
        'index.html'
        'iisstart.htm'
        'default.aspx'
        'index.php'
        'hostingstart.html'
      ]
      requestTracingEnabled: false
      remoteDebuggingEnabled: false
      remoteDebuggingVersion: 'VS2022'
      httpLoggingEnabled: false
      logsDirectorySizeLimit: 35
      detailedErrorLoggingEnabled: false
      publishingUsername: 'REDACTED'
      scmType: 'none'
      use32BitWorkerProcess: true
      webSocketsEnabled: false
      appCommandLine: ''
      managedPipelineMode: 'Integrated'
      virtualApplications: [
        {
          virtualPath: '/'
          physicalPath: 'site\\wwwroot'
          preloadEnabled: true
        }
      ]
      loadBalancing: 'LeastRequests'
      experiments: {
        rampUpRules: []
      }
      autoHealEnabled: false
      vnetRouteAllEnabled: true
      vnetPrivatePortsCount: 0
      publicNetworkAccess: publicNetworkAccess
      localMySqlEnabled: false
      ipSecurityRestrictions: ipSecurityRestrictions
      ipSecurityRestrictionsDefaultAction: 'Deny'
      scmIpSecurityRestrictions: scmIpSecurityRestrictions
      scmIpSecurityRestrictionsDefaultAction: 'Deny'
      scmIpSecurityRestrictionsUseMain: false
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      preWarmedInstanceCount: 0
      elasticWebAppScaleLimit: 0
      functionsRuntimeScaleMonitoringEnabled: false
      azureStorageAccounts: {}
    }
    scmSiteAlsoStopped: false
    clientAffinityEnabled: true
    clientCertEnabled: false
    clientCertMode: 'Required'
    hostNamesDisabled: false
    outboundVnetRouting: {
      allTraffic: true
      applicationTraffic: true
      backupRestoreTraffic: true
      contentShareTraffic: true
      imagePullTraffic: false
    }
    containerSize: 0
    dailyMemoryTimeQuota: 0
    httpsOnly: true
    redundancyMode: 'None'
    publicNetworkAccess: publicNetworkAccess
    storageAccountRequired: false
    keyVaultReferenceIdentity: existingUserAssignedIdentity.id
  }
}

resource appServiceFtp 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: appService
  name: 'ftp'
  properties: {
    allow: true
  }
}

resource appServiceScm 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: appService
  name: 'scm'
  properties: {
    allow: true
  }
}

resource appServiceHostNameBindings 'Microsoft.Web/sites/hostNameBindings@2024-04-01' = {
  parent: appService
  name: '${appServiceName}.azurewebsites.net'
  properties: {
    siteName: appServiceName
    hostNameType: 'Verified'
  }
}

output appServiceId string = appService.id
