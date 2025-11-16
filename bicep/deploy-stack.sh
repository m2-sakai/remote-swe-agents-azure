#!/bin/bash

az stack group create --name 'remote-swe-agent-azure-stack' --resource-group m2-sakai-je-RG-01 --template-file templates/main.bicep --parameter parameters/main.bicepparam  --action-on-unmanage 'deleteResources' --deny-settings-mode 'denyDelete'
