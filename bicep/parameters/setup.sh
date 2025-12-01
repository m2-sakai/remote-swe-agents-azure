#!/bin/bash
set -e

# This script must be run as root (via sudo or Packer provisioner)
# Some commands are explicitly run as 'azureuser' using 'sudo -u azureuser'

# Prevent interactive prompts during package installation
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

echo "=== Starting Worker VM Setup ==="

# System update
apt-get -o DPkg::Lock::Timeout=-1 update
apt-get -o DPkg::Lock::Timeout=-1 -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade -y

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

# Create azureuser if not exists (for Image Builder environment)
if ! id azureuser >/dev/null 2>&1; then
    useradd -m -s /bin/bash azureuser
fi

groupadd docker || true
usermod -aG docker azureuser

# Install Node.js 22 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

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
sudo -u azureuser npx --yes playwright install-deps
sudo -u azureuser npx --yes playwright install chromium

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

STORAGE_ACCOUNT_NAME="m2sakaijestorage01"
CONTAINER_NAME="worker-source"
BLOB_NAME="source.tar.gz"
ETAG_FILE="/opt/myapp/.source_etag"

# Function to download and setup fresh source
download_fresh_files() {
  echo "Downloading fresh source files from Blob Storage."
  rm -rf ./{*,.*} 2>/dev/null || echo "Cleaning up existing files"
  
  # Download from Blob Storage using Managed Identity
  az login --identity
  az storage blob download \
    --account-name m2sakaijestorage01 \
    --container-name worker-source \
    --name source.tar.gz \
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
az login --identity
CURRENT_ETAG=$(az storage blob show \
  --account-name m2sakaijestorage01 \
  --container-name worker-source \
  --name source.tar.gz \
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

# Note: Source files will be downloaded on first VM boot via start-app.sh
# (skipped during image build as managed identity is not available)

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
ExecStart=/bin/bash /opt/scripts/start-app.sh
Restart=always
RestartSec=10
TimeoutStartSec=600
TimeoutStopSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=myapp
Environment=WORKER_RUNTIME=vm
Environment=AZURE_REGION=japaneast
Environment=AZURE_STORAGE_ACCOUNT_NAME=m2sakaijestorage01
Environment=AZURE_WEB_PUBSUB_ENDPOINT=
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