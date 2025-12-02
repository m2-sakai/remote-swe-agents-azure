#!/bin/bash

set -e

sudo -u azureuser env \
  WORKER_RUNTIME=vm \
  AZURE_REGION=japaneast \
  AZURE_STORAGE_ACCOUNT_NAME=m2sakaijestorage01 \
  AZURE_WEB_PUBSUB_ENDPOINT=https://m2-sakai-je-WPS-01.webpubsub.azure.com \
  AZURE_CLIENT_ID=0e7bc110-c9e7-470c-b387-550321a0d73c \
  AZURE_COSMOS_ENDPOINT=https://m2-sakai-je-cosmos-01.documents.azure.com \
  AZURE_OPENAI_ENDPOINT=https://m2-sakai-je-openai-01.openai.azure.com \
  /bin/bash /opt/scripts/start-app.sh 2>&1 | tee /home/azureuser/log/worker.log