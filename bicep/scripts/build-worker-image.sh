#!/bin/bash
set -e

# 1. イメージをビルド（20-30分かかります）
az image builder run \
  --resource-group m2-sakai-je-RG-01 \
  --name m2-sakai-je-worker-template-01

# 2. ビルド状況を確認
az image builder show \
  --resource-group m2-sakai-je-RG-01 \
  --name m2-sakai-je-worker-template-01 \
  --query lastRunStatus

# 3. ビルド完了後、Image IDを取得
az sig image-version show \
  --resource-group m2-sakai-je-RG-01 \
  --gallery-name m2_sakai_je_remotesweagent_gallery \
  --gallery-image-definition m2_sakai_je_workervm_image_definition \
  --gallery-image-version 1.0.0 \
  --query id -o tsv