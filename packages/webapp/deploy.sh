#!/bin/bash

# Webapp Deployment Script
# Usage: ./deploy.sh <app-name> <resource-group>

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <app-name> <resource-group>"
    echo "Example: $0 m2-sakai-je-APP-01 m2-sakai-je-RG-01"
    exit 1
fi

APP_NAME=$1
RESOURCE_GROUP=$2
echo "==================================="
echo "Webapp Deployment Script"
echo "==================================="
echo "App Name: $APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

# ビルド
echo "Building the web application..."
npm run build
echo "Build completed."
echo ""

# デプロイ
echo "Deploying the web application to Azure..."
az webapp deploy --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --src-path ./build
echo "Deployment completed."
echo ""
echo "Web application deployed successfully to Azure Web App: $APP_NAME in Resource Group: $RESOURCE_GROUP"
echo "==================================="

