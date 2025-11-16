#!/bin/bash
# 既存のリソースに対してDockerイメージを更新するスクリプト
set -e

ACR_NAME="${ACR_NAME:-remotesweagentacr}"
WEBAPP_NAME="${WEBAPP_NAME:-remote-swe-agent-webapp}"
RESOURCE_GROUP="${RESOURCE_GROUP:-remote-swe-agent-rg}"
IMAGE_NAME="webapp"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"

echo "=== Docker イメージの更新とデプロイ ==="
echo "ACR: $ACR_NAME"
echo "Web App: $WEBAPP_NAME"
echo "Image Tag: $IMAGE_TAG"
echo ""

# ACR にログイン
echo "1. ACR にログイン..."
az acr login --name "$ACR_NAME"

# Docker イメージをビルド
echo ""
echo "2. Docker イメージをビルド..."
cd "$(dirname "$0")/.."
docker build \
  -f docker/webapp.Dockerfile \
  -t "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
  -t "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest" \
  .

# Docker イメージをプッシュ
echo ""
echo "3. Docker イメージをプッシュ..."
docker push "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
docker push "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"

# Web App のコンテナイメージを更新
echo ""
echo "4. Web App のコンテナイメージを更新..."
az webapp config container set \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --docker-custom-image-name "$ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG" \
  --output table

# Web App を再起動
echo ""
echo "5. Web App を再起動..."
az webapp restart \
  --name "$WEBAPP_NAME" \
  --resource-group "$RESOURCE_GROUP"

echo ""
echo "=== デプロイ完了 ==="
echo "Web App URL: https://$WEBAPP_NAME.azurewebsites.net"
echo "Image: $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG"
