import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';
import { DefaultAzureCredential } from '@azure/identity';
import { sendWebappEvent } from './events';
import { updateSession } from './sessions';
import { InstanceStatus } from '../schema';

const credential = new DefaultAzureCredential();
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID || '';
const resourceGroupName = process.env.AZURE_RESOURCE_GROUP_NAME || '';
const vmImageId = process.env.AZURE_VM_IMAGE_ID || '';
const vmSize = process.env.AZURE_VM_SIZE || 'Standard_D2s_v3';
const subnetId = process.env.AZURE_VM_SUBNET_ID || '';

function logEnvDiagnostics() {
  console.log('[worker-manager/env] SUBSCRIPTION_ID set:', !!subscriptionId);
  console.log('[worker-manager/env] RESOURCE_GROUP_NAME:', resourceGroupName || '(empty)');
  console.log('[worker-manager/env] VM_IMAGE_ID:', vmImageId || '(empty)');
  console.log('[worker-manager/env] VM_SIZE:', vmSize);
  console.log('[worker-manager/env] SUBNET_ID set:', !!subnetId);
}

let computeClient: ComputeManagementClient | null = null;
let networkClient: NetworkManagementClient | null = null;

function getComputeClient(): ComputeManagementClient {
  if (!computeClient) {
    if (!subscriptionId) {
      throw new Error('AZURE_SUBSCRIPTION_ID environment variable is not set');
    }
    console.log('[worker-manager] Creating ComputeManagementClient');
    computeClient = new ComputeManagementClient(credential, subscriptionId);
  }
  return computeClient;
}

function getNetworkClient(): NetworkManagementClient {
  if (!networkClient) {
    if (!subscriptionId) {
      throw new Error('AZURE_SUBSCRIPTION_ID environment variable is not set');
    }
    console.log('[worker-manager] Creating NetworkManagementClient');
    networkClient = new NetworkManagementClient(credential, subscriptionId);
  }
  return networkClient;
}

/**
 * Updates the instance status in Cosmos DB and sends a webapp event
 */
export async function updateInstanceStatus(workerId: string, status: InstanceStatus) {
  try {
    await updateSession(workerId, { instanceStatus: status });
    await sendWebappEvent(workerId, { type: 'instanceStatusChanged', status });
    console.log('[worker-manager] instanceStatusChanged', { workerId, status });
  } catch (error) {
    console.error('[worker-manager] Error updating instance status', { workerId, status, error });
  }
}

async function findWorkerVMInstance(workerId: string): Promise<string | null> {
  try {
    console.log('[worker-manager] Searching for existing VM by tag RemoteSweWorkerId', { workerId });
    const vms = getComputeClient().virtualMachines.list(resourceGroupName);
    for await (const vm of vms) {
      if (!vm.tags) continue;
      if (vm.tags['RemoteSweWorkerId'] === workerId) {
        console.log('[worker-manager] Found existing VM', { vmName: vm.name });
        return vm.name || null;
      }
    }
    console.log('[worker-manager] No existing VM found', { workerId });
    return null;
  } catch (error) {
    console.error('[worker-manager] Error finding worker VM', { workerId, error });
    throw error;
  }
}

async function getVMInstanceStatus(vmName: string): Promise<string | null> {
  try {
    const instanceView = await getComputeClient().virtualMachines.instanceView(resourceGroupName, vmName);
    if (instanceView.statuses && instanceView.statuses.length > 0) {
      const powerState = instanceView.statuses.find((status: any) => status.code?.startsWith('PowerState/'));
      if (powerState?.code) {
        const state = powerState.code.split('/')[1] || null;
        console.log('[worker-manager] VM power state', { vmName, state });
        return state;
      }
    }
    console.log('[worker-manager] VM power state not found', { vmName });
    return null;
  } catch (error) {
    console.error('[worker-manager] Error getting VM instance status', { vmName, error });
    return null;
  }
}

async function startVMInstance(vmName: string): Promise<void> {
  try {
    console.log('[worker-manager] Starting existing VM', { vmName });
    await getComputeClient().virtualMachines.beginStartAndWait(resourceGroupName, vmName);
    console.log('[worker-manager] Started VM instance', { vmName });
  } catch (error) {
    console.error('[worker-manager] Error starting VM', { vmName, error });
    throw error;
  }
}

async function createVMInstance(workerId: string): Promise<{ instanceId: string }> {
  try {
    const vmName = `worker-${workerId}`;
    const nicName = `${vmName}-nic`;
    console.log('[worker-manager] Creating new VM', { workerId, vmName });

    const nicParams = {
      location: process.env.AZURE_LOCATION || 'japaneast',
      ipConfigurations: [
        {
          name: 'ipconfig1',
          subnet: { id: subnetId },
        },
      ],
    };
    console.log('[worker-manager] Creating NIC', { nicName, subnetId });
    const nic = await getNetworkClient().networkInterfaces.beginCreateOrUpdateAndWait(
      resourceGroupName,
      nicName,
      nicParams as any
    );
    console.log('[worker-manager] NIC created', { nicId: nic.id });

    const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || '';
    const cloudInitScript = `#cloud-config
write_files:
  - path: /etc/systemd/system/myapp.service.d/override.conf
    content: |
      [Service]
      Environment="AZURE_STORAGE_ACCOUNT_NAME=${storageAccountName}"
runcmd:
  - systemctl daemon-reload
  - systemctl start myapp.service
`;
    const vmParams = {
      location: process.env.AZURE_LOCATION || 'eastus',
      hardwareProfile: { vmSize },
      storageProfile: {
        imageReference: { id: vmImageId },
        osDisk: { createOption: 'FromImage', managedDisk: { storageAccountType: 'Premium_LRS' } },
      },
      osProfile: {
        computerName: vmName,
        adminUsername: process.env.AZURE_VM_ADMIN_USERNAME || 'azureuser',
        adminPassword: process.env.AZURE_VM_ADMIN_PASSWORD,
        customData: Buffer.from(cloudInitScript).toString('base64'),
        linuxConfiguration: {
          disablePasswordAuthentication: false,
        },
      },
      networkProfile: { networkInterfaces: [{ id: nic.id, primary: true }] },
      tags: { RemoteSweWorkerId: workerId },
    };
    console.log('[worker-manager] Creating VM with params', { vmName, vmImageId, vmSize });
    await getComputeClient().virtualMachines.beginCreateOrUpdateAndWait(resourceGroupName, vmName, vmParams as any);
    console.log('[worker-manager] VM created', { vmName, workerId });
    return { instanceId: vmName };
  } catch (error) {
    console.error('[worker-manager] Error creating VM', { workerId, error });
    throw error;
  }
}

export async function getOrCreateWorkerInstance(
  workerId: string,
  workerType: 'agent-core' | 'vm' = 'vm'
): Promise<{ instanceId: string; oldStatus: 'stopped' | 'terminated' | 'running' }> {
  console.log('[worker-manager] getOrCreateWorkerInstance START', { workerId, workerType });
  logEnvDiagnostics();
  if (workerType === 'agent-core') {
    console.log('[worker-manager] Using agent-core runtime, skipping VM creation', { workerId });
    return { instanceId: 'local', oldStatus: 'running' };
  }

  // Check if a VM instance with this workerId already exists
  const existingVM = await findWorkerVMInstance(workerId);

  if (existingVM) {
    const status = await getVMInstanceStatus(existingVM);

    if (status === 'running' || status === 'starting') {
      console.log('[worker-manager] VM already running', { workerId, vmName: existingVM, status });
      return { instanceId: existingVM, oldStatus: 'running' };
    }
    if (status === 'deallocated' || status === 'stopped') {
      console.log('[worker-manager] Starting stopped VM', { workerId, vmName: existingVM, status });
      await updateInstanceStatus(workerId, 'starting');
      await startVMInstance(existingVM);
      return { instanceId: existingVM, oldStatus: 'stopped' };
    }
  }

  console.log('[worker-manager] No existing instance, creating new', { workerId });
  await updateInstanceStatus(workerId, 'starting');
  const { instanceId } = await createVMInstance(workerId);
  return { instanceId, oldStatus: 'terminated' };
}
