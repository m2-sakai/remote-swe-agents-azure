#!/bin/bash
set -e

# 設定
RESOURCE_GROUP="${RESOURCE_GROUP:-remote-swe-agent-rg}"
LOCATION="${LOCATION:-japaneast}"
ACR_NAME="${ACR_NAME:-remotesweagentacr}"
WEBAPP_NAME="${WEBAPP_NAME:-remote-swe-agent-webapp}"
APP_SERVICE_PLAN="${APP_SERVICE_PLAN:-remote-swe-agent-plan}"
IMAGE_NAME="webapp"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "=== Azure Web App for Containers デプロイスクリプト ==="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "ACR Name: $ACR_NAME"
echo "Web App Name: $WEBAPP_NAME"
echo ""

# Azure にログイン確認
echo "1. Azure ログイン状態を確認..."
az account show > /dev/null 2>&1 || {
  echo "Azure にログインしていません。ログインしてください。"
  az login
}

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "使用中のサブスクリプション: $SUBSCRIPTION_ID"
echo ""

# リソースグループの作成
echo "2. リソースグループを作成..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output table

# Azure Container Registry の作成
echo ""
echo "3. Azure Container Registry を作成..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output table

# ACR にログイン
echo ""
echo "4. Azure Container Registry にログイン..."
az acr login --name "$ACR_NAME"

# Docker イメージをビルド
echo ""
echo "5. Docker イメージをビルド..."
cd "$(dirname "$0")/.."
docker build \
  -f docker/webapp.Dockerfile \
  -t "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
  .

# Docker イメージをプッシュ
echo ""
echo "6. Docker イメージを ACR にプッシュ..."
docker push "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"

# App Service Plan の作成
echo ""
echo "7. App Service Plan を作成..."
az appservice plan create \
  --name "$APP_SERVICE_PLAN" \
  --resource-group "$RESOURCE_GROUP" \
  --is-linux \
  --sku B1 \
  --output table

# Web App の作成
echo ""
echo "8. Web App for Containers を作成..."
az webapp create \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$APP_SERVICE_PLAN" \
  --name "$WEBAPP_NAME" \
  --deployment-container-image-name "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
  --output table

# ACR 資格情報を取得
echo ""
echo "9. ACR 資格情報を設定..."
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query passwords[0].value -o tsv)

az webapp config container set \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
  --docker-registry-server-url "https://$ACR_NAME.azurecr.io" \
  --docker-registry-server-user "$ACR_USERNAME" \
  --docker-registry-server-password "$ACR_PASSWORD" \
  --output table

# 環境変数を設定（必要に応じて更新してください）
echo ""
echo "10. 環境変数を設定..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBAPP_NAME" \
  --settings \
    NODE_ENV=production \
    WEBSITES_PORT=8080 \
    AZURE_COSMOS_ENDPOINT="<YOUR_COSMOS_ENDPOINT>" \
    AZURE_COSMOS_DATABASE_ID="remote-swe-agents" \
    AZURE_STORAGE_ACCOUNT_NAME="<YOUR_STORAGE_ACCOUNT>" \
    AZURE_STORAGE_CONTAINER_NAME="remote-swe-agents" \
    AZURE_OPENAI_ENDPOINT="<YOUR_OPENAI_ENDPOINT>" \
    AZURE_AD_CLIENT_ID="<YOUR_AD_CLIENT_ID>" \
    AZURE_AD_TENANT_ID="<YOUR_AD_TENANT_ID>" \
    AZURE_AD_CLIENT_SECRET="<YOUR_AD_CLIENT_SECRET>" \
    NEXTAUTH_SECRET="<GENERATE_RANDOM_SECRET>" \
    APP_ORIGIN="https://$WEBAPP_NAME.azurewebsites.net" \
    NEXTAUTH_URL="https://$WEBAPP_NAME.azurewebsites.net" \
  --output table

# マネージドIDを有効化
echo ""
echo "11. システム割り当てマネージド ID を有効化..."
az webapp identity assign \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output table

MANAGED_IDENTITY_ID=$(az webapp identity show \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId -o tsv)

echo "マネージド ID: $MANAGED_IDENTITY_ID"

# 継続的デプロイを有効化（オプション）
echo ""
echo "12. Web App を再起動..."
az webapp restart \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output table

echo ""
echo "=== デプロイ完了 ==="
echo "Web App URL: https://$WEBAPP_NAME.azurewebsites.net"
echo ""
echo "次のステップ:"
echo "1. 環境変数を実際の値に更新してください:"
echo "   az webapp config appsettings set --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --settings <KEY>=<VALUE>"
echo ""
echo "2. マネージド ID に Cosmos DB と Storage のアクセス権を付与してください:"
echo "   - Cosmos DB: Cosmos DB Built-in Data Contributor"
echo "   - Storage: Storage Blob Data Contributor"
echo ""
echo "3. Azure AD アプリ登録でリダイレクト URI を追加してください:"
echo "   https://$WEBAPP_NAME.azurewebsites.net/auth-callback"
