using '../templates/main.bicep'

var subscriptionId = 'd13f1cb9-3e28-43db-9497-380b6524aac5'
var resourceGroupName = 'm2-sakai-je-RG-01'

// 共通
param tag = {
  owner: 'm2-sakai'
  project: 'remote-swe-agents-azure'
}

// マネージドID
param userAssignedIdentityName = 'm2-sakai-je-ID-01'

// Log Analytics / Application Insights
param logAnalyticsWorkspaceName = 'm2-sakai-je-LOGANA-01'
param applicationInsightsName = 'm2-sakai-je-APPINS-01'

// NSG
param networkSecurityGroups = [
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Outbound-sub-0_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-PubSub-sub-1_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Cosmos-sub-2_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-OpenAI-sub-3_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-KV-sub-4_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Storage-sub-5_0'
    securityRules: []
  }
  {
    networkSecurityGroupName: 'm2-sakai-je-NSG-Vm-sub-6_0'
    securityRules: []
  }
]

// 仮想ネットワーク / サブネット
param virtualNetworkName = 'm2-sakai-je-VNET-01'
param addressPrefixes = ['172.16.0.0/16']
param subnets = [
  {
    subnetName: 'Outbound-sub-0_0'
    addressPrefix: '172.16.0.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Outbound-sub-0_0'
    serviceEndpoints: []
    delegations: [
      {
        name: 'Microsoft.Web/serverFarms'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
        type: 'Microsoft.Network/virtualNetworks/subnets/delegations'
      }
    ]
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'PubSub-sub-1_0'
    addressPrefix: '172.16.1.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-PubSub-sub-1_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'Cosmos-sub-2_0'
    addressPrefix: '172.16.2.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Cosmos-sub-2_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'OpenAI-sub-3_0'
    addressPrefix: '172.16.3.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-OpenAI-sub-3_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'KV-sub-4_0'
    addressPrefix: '172.16.4.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-KV-sub-4_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'Storage-sub-5_0'
    addressPrefix: '172.16.5.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Storage-sub-5_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Enabled'
  }
  {
    subnetName: 'Vm-sub-6_0'
    addressPrefix: '172.16.6.0/24'
    networkSecurityGroupName: 'm2-sakai-je-NSG-Vm-sub-6_0'
    serviceEndpoints: []
    delegations: []
    privateLinkServiceNetworkPolicies: 'Disabled'
  }
]

// プライベートDNSゾーン
param privateDnsZones = [
  {
    privateDnsZoneName: 'privatelink.openai.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.documents.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.webpubsub.azure.com'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.blob.core.windows.net'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.vaultcore.azure.net'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
  {
    privateDnsZoneName: 'privatelink.azurecr.io'
    privateDnsZoneVnetLinkName: 'lint-VNET-01'
  }
]

// コンテナーレジストリ
param containerRegistryName = 'm2sakaijeacr01'
param skuName = 'Basic'

// Key Vault
param keyVaultName = 'm2-sakai-je-KV-98'
param kvPrivateEndpointName = 'm2-sakai-je-PEP-KV-01'
param kvPrivateLinkServiceGroupIds = [
  'vault'
]
param kvPrivateEndpointSubnetName = 'KV-sub-4_0'
param kvPrivateDnsZoneName = 'privatelink.vaultcore.azure.net'
param kvRoleDefinitionId = '4633458b-17de-408a-b874-0445c86b69e6'

// App Service Plan / App Service
param appServicePlanName = 'm2-sakai-je-ASP-01'
param appServicePlanSkuName = 'P0V3'
param appServiceName = 'm2-sakai-je-APP-01'
param runtimeStack = 'DOCKER|${containerRegistryName}.azurecr.io/remote-swe-agent-azure-webapp:latest'
param vnetIntegrationSubnetName = 'Outbound-sub-0_0'
param aplAppSettings = [
  {
    name: 'AZURE_AD_CLIENT_ID'
    value: '40d43ebb-7e58-4460-ae5f-d29a27f1e8eb'
  }
  {
    name: 'AZURE_AD_CLIENT_SECRET'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AzureAdClientSecret)'
  }
  {
    name: 'AZURE_AD_REDIRECT_URI'
    value: 'https://${appServiceName}.azurewebsites.net/api/auth/callback'
  }
  {
    name: 'AZURE_AD_TENANT_ID'
    value: 'fd35dd5c-69a6-4265-96e7-8702fe2bcb07'
  }
  {
    name: 'AZURE_COSMOS_CONTAINER_NAME'
    value: 'remote-swe-agents'
  }
  {
    name: 'AZURE_COSMOS_DATABASE_ID'
    value: 'remote-swe-agents'
  }
  {
    name: 'AZURE_COSMOS_ENDPOINT'
    value: 'https://${cosmosDbName}.documents.azure.com/'
  }
  {
    name: 'AZURE_VM_SUBNET_ID'
    value: '/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Network/virtualNetworks/${virtualNetworkName}/subnets/Vm-sub-6_0'
  }
  {
    name: 'AZURE_SUBSCRIPTION_ID'
    value: subscriptionId
  }
  {
    name: 'AZURE_WEB_PUBSUB_ENDPOINT'
    value: 'https://${webPubSubName}.webpubsub.azure.com'
  }
  {
    name: 'APP_ORIGIN'
    value: 'https://${appServiceName}.azurewebsites.net'
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_URL'
    value: '${containerRegistryName}.azurecr.io'
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_USERNAME'
    value: containerRegistryName
  }
  {
    name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
    value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AcrAdminPassword)'
  }
  {
    name: 'NEXT_PUBLIC_APP_ORIGIN'
    value: 'https://${appServiceName}.azurewebsites.net'
  }
  {
    name: 'PORT'
    value: '3000'
  }
  {
    name: 'SKIP_AUTH'
    value: 'false'
  }
]

// Storage Account
param storageAccountName = 'm2sakaijestorage01'
param storageAccountPrivateEndpointName = 'm2-sakai-je-PEP-Storage-01'
param storageAccountPrivateLinkServiceGroupIds = [
  'blob'
]
param storageAccountPrivateEndpointSubnetName = 'Storage-sub-5_0'
param storageAccountPrivateDnsZoneName = 'privatelink.blob.core.windows.net'

// Cosmos DB
param cosmosDbName = 'm2-sakai-je-cosmos-01'
param cosmosPrivateEndpointName = 'm2-sakai-je-PEP-COSMOS-01'
param cosmosPrivateLinkServiceGroupIds = [
  'Sql'
]
param cosmosPrivateEndpointSubnetName = 'Cosmos-sub-2_0'
param cosmosPrivateDnsZoneName = 'privatelink.documents.azure.com'

// Web PubSub
param webPubSubName = 'm2-sakai-je-WPS-01'
param webPubSubPrivateEndpointName = 'm2-sakai-je-PEP-PubSub-01'
param webPubSubPrivateLinkServiceGroupIds = [
  'webpubsub'
]
param webPubSubPrivateEndpointSubnetName = 'PubSub-sub-1_0'
param webPubSubPrivateDnsZoneName = 'privatelink.webpubsub.azure.com'
param hubName = 'remoteswehub'

// Azure OpenAI
param openAIAccountName = 'm2-sakai-je-openai-01'
param openAIPrivateEndpointName = 'm2-sakai-je-PEP-OpenAI-01'
param openAIPrivateLinkServiceGroupIds = [
  'account'
]
param openAIPrivateEndpointSubnetName = 'OpenAI-sub-3_0'
param openAIPrivateDnsZoneName = 'privatelink.openai.azure.com'

// Gallery
param galleryName = 'm2_sakai_je_remotesweagent_gallery'
param galleryDescription = 'Remote SWE Agents Worker Images'
param imageDefinitionName = 'm2_sakai_je_workervm_image_definition'
param imageDescription = 'Worker VM with Node.js, Docker, and agent packages pre-installed'

// Image Builder
param imageTemplateName = 'm2-sakai-je-worker-template-01'
param imageVersion = '1.0.0'
param vmSubnetName = 'Vm-sub-6_0'
param setupScript = '''
#!/bin/bash
set -e

echo "=== Starting Worker VM Setup ==="

# System update
apt-get -o DPkg::Lock::Timeout=-1 update
apt-get -o DPkg::Lock::Timeout=-1 upgrade -y

# Install Python3
apt-get -o DPkg::Lock::Timeout=-1 install -y python3-pip unzip
ln -s -f /usr/bin/pip3 /usr/bin/pip
ln -s -f /usr/bin/python3 /usr/bin/python

# Install Docker
apt-get -o DPkg::Lock::Timeout=-1 install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get -o DPkg::Lock::Timeout=-1 update
apt-get -o DPkg::Lock::Timeout=-1 install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
groupadd docker || true
usermod -aG docker azureuser

# Install Node.js via nvm
sudo -u azureuser bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.2/install.sh | bash"
sudo -u azureuser bash -c -i "nvm install 22"

# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Install GitHub CLI
(type -p wget >/dev/null || (apt update && apt-get install wget -y)) \
  && mkdir -p -m 755 /etc/apt/keyrings \
  && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  && cat $out | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get -o DPkg::Lock::Timeout=-1 update \
  && apt-get -o DPkg::Lock::Timeout=-1 install gh -y

# Configure Git for azureuser
sudo -u azureuser bash -c 'git config --global user.name "remote-swe-app[bot]"'
sudo -u azureuser bash -c 'git config --global user.email "123456+remote-swe-app[bot]@users.noreply.github.com"'

# Install uv
sudo -u azureuser bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'

# Create application directory
mkdir -p /opt/myapp && cd /opt/myapp
chown -R azureuser:azureuser /opt/myapp

# Install Playwright dependencies
sudo -u azureuser bash -i -c "npx playwright install-deps"
sudo -u azureuser bash -i -c "npx playwright install chromium"

# Disable Ubuntu security feature for Chromium
echo 0 | tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns
echo kernel.apparmor_restrict_unprivileged_userns=0 | tee /etc/sysctl.d/60-apparmor-namespace.conf

# Configure GitHub CLI
sudo -u azureuser bash -c "gh config set prompt disabled"

# Create scripts directory
mkdir -p /opt/scripts

# Create startup script
cat << 'STARTEOF' > /opt/scripts/start-app.sh
#!/bin/bash
set -e

STORAGE_ACCOUNT_NAME="${AZURE_STORAGE_ACCOUNT_NAME}"
CONTAINER_NAME="worker-source"
BLOB_NAME="source.tar.gz"
ETAG_FILE="/opt/myapp/.source_etag"

# Function to download and setup fresh source
download_fresh_files() {
  echo "Downloading fresh source files from Blob Storage."
  rm -rf ./{*,.*} 2>/dev/null || echo "Cleaning up existing files"
  
  # Download from Blob Storage using Managed Identity
  az storage blob download \
    --account-name $STORAGE_ACCOUNT_NAME \
    --container-name $CONTAINER_NAME \
    --name $BLOB_NAME \
    --file ./source.tar.gz \
    --auth-mode login
  
  # Extract
  tar -xzf source.tar.gz
  rm -f source.tar.gz
  
  # Install and build
  npm ci
  npm run build -w packages/agent-core
  
  cd packages/worker
  npx playwright install chromium
  cd -
  
  # Save ETag
  echo "$CURRENT_ETAG" > "$ETAG_FILE"
}

# Get current ETag from Blob Storage
CURRENT_ETAG=$(az storage blob show \
  --account-name $STORAGE_ACCOUNT_NAME \
  --container-name $CONTAINER_NAME \
  --name $BLOB_NAME \
  --auth-mode login \
  --query etag -o tsv)

# Check if we need to update
if [ -f "$ETAG_FILE" ]; then
  CACHED_ETAG=$(cat $ETAG_FILE)
  
  if [ "$CURRENT_ETAG" == "$CACHED_ETAG" ]; then
    echo "ETag matches. Using existing source files."
  else
    download_fresh_files
  fi
else
  download_fresh_files
fi

if [ "$NO_START" == "true" ]; then
  echo "NO_START=true is passed. Exiting..."
  exit 0
fi

# Get Worker ID from Azure Instance Metadata
export WORKER_ID=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/instance/compute/tags?api-version=2021-01-01&format=text" | grep -oP 'RemoteSweWorkerId:\K[^;]+')

# Start application
cd packages/worker
npx tsx src/main.ts
STARTEOF

chmod +x /opt/scripts/start-app.sh
chown azureuser:azureuser /opt/scripts/start-app.sh

# Cache worker files
sudo -u azureuser bash -i -c "NO_START=true /opt/scripts/start-app.sh"

# Create systemd service
cat << 'SERVICEEOF' > /etc/systemd/system/myapp.service
[Unit]
Description=Remote SWE Agent Worker
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=azureuser
WorkingDirectory=/opt/myapp
ExecStart=/bin/bash -i -c /opt/scripts/start-app.sh
Restart=always
RestartSec=10
TimeoutStartSec=600
TimeoutStopSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp
Environment=WORKER_RUNTIME=ec2
Environment=AZURE_REGION=japaneast
Environment=AZURE_STORAGE_ACCOUNT_NAME=YOUR_STORAGE_ACCOUNT_NAME
Environment=AZURE_WEB_PUBSUB_ENDPOINT=YOUR_WEB_PUBSUB_ENDPOINT
Environment=AZURE_CLIENT_ID=YOUR_MANAGED_IDENTITY_CLIENT_ID

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable service (but don't start - will be started by cloud-init)
systemctl daemon-reload
systemctl enable myapp

# Clean up
apt-get autoremove -y
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "=== Worker VM Setup Complete ==="
'''
