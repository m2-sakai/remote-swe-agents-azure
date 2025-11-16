import { ComputeManagementClient } from '@azure/arm-compute';
import { NetworkManagementClient } from '@azure/arm-network';
import { DefaultAzureCredential } from '@azure/identity';
import { sendWebappEvent } from './events';
import { updateSession } from './sessions';
import { InstanceStatus } from '../schema';

const credential = new DefaultAzureCredential();
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID!;
const resourceGroupName = process.env.AZURE_RESOURCE_GROUP_NAME!;
const vmImageId = process.env.AZURE_VM_IMAGE_ID!; // Managed Image or Azure Compute Gallery Image ID
const vmSize = process.env.AZURE_VM_SIZE || 'Standard_D2s_v3';
const subnetId = process.env.AZURE_SUBNET_ID!;

const computeClient = new ComputeManagementClient(credential, subscriptionId);
const networkClient = new NetworkManagementClient(credential, subscriptionId);

/**
 * Updates the instance status in Cosmos DB and sends a webapp event
 */
export async function updateInstanceStatus(workerId: string, status: InstanceStatus) {
  try {
    // Update the instanceStatus using the generic updateSession function
    await updateSession(workerId, { instanceStatus: status });

    // Send event to webapp
    await sendWebappEvent(workerId, {
      type: 'instanceStatusChanged',
      status,
    });

    console.log(`Instance status updated to ${status}`);
  } catch (error) {
    console.error(`Error updating instance status for workerId ${workerId}:`, error);
  }
}

async function findWorkerVMInstance(workerId: string): Promise<string | null> {
  try {
    // List all VMs in the resource group
    const vms = computeClient.virtualMachines.list(resourceGroupName);

    for await (const vm of vms) {
      if (!vm.tags) continue;

      // Check if this VM has the matching workerId tag
      if (vm.tags['RemoteSweWorkerId'] === workerId) {
        return vm.name || null;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error finding worker VM instance for workerId ${workerId}:`, error);
    throw error;
  }
}

async function getVMInstanceStatus(vmName: string): Promise<string | null> {
  try {
    const instanceView = await computeClient.virtualMachines.instanceView(resourceGroupName, vmName);

    if (instanceView.statuses && instanceView.statuses.length > 0) {
      // Find the PowerState status
      const powerState = instanceView.statuses.find((status: any) => status.code?.startsWith('PowerState/'));
      if (powerState?.code) {
        // Extract the state (e.g., "PowerState/running" -> "running")
        return powerState.code.split('/')[1] || null;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting VM instance status for VM ${vmName}:`, error);
    return null;
  }
}

async function startVMInstance(vmName: string): Promise<void> {
  try {
    await computeClient.virtualMachines.beginStartAndWait(resourceGroupName, vmName);
    console.log(`Started VM instance ${vmName}`);
  } catch (error) {
    console.error(`Error starting VM instance ${vmName}:`, error);
    throw error;
  }
}

async function createVMInstance(workerId: string): Promise<{ instanceId: string }> {
  try {
    const vmName = `worker-${workerId}`;
    const nicName = `${vmName}-nic`;

    // Create network interface
    const nicParams = {
      location: process.env.AZURE_LOCATION || 'eastus',
      ipConfigurations: [
        {
          name: 'ipconfig1',
          subnet: {
            id: subnetId,
          },
        },
      ],
    };

    const nic = await networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
      resourceGroupName,
      nicName,
      nicParams as any
    );

    // Create VM
    const vmParams = {
      location: process.env.AZURE_LOCATION || 'eastus',
      hardwareProfile: {
        vmSize: vmSize,
      },
      storageProfile: {
        imageReference: {
          id: vmImageId,
        },
        osDisk: {
          createOption: 'FromImage',
          managedDisk: {
            storageAccountType: 'Premium_LRS',
          },
        },
      },
      osProfile: {
        computerName: vmName,
        adminUsername: process.env.AZURE_VM_ADMIN_USERNAME || 'azureuser',
        linuxConfiguration: {
          disablePasswordAuthentication: true,
          ssh: {
            publicKeys: [
              {
                path: `/home/${process.env.AZURE_VM_ADMIN_USERNAME || 'azureuser'}/.ssh/authorized_keys`,
                keyData: process.env.AZURE_VM_SSH_PUBLIC_KEY!,
              },
            ],
          },
        },
      },
      networkProfile: {
        networkInterfaces: [
          {
            id: nic.id,
            primary: true,
          },
        ],
      },
      tags: {
        RemoteSweWorkerId: workerId,
      },
    };

    await computeClient.virtualMachines.beginCreateOrUpdateAndWait(resourceGroupName, vmName, vmParams as any);

    console.log(`Created VM instance ${vmName} for workerId ${workerId}`);
    return { instanceId: vmName };
  } catch (error) {
    console.error(`Error creating VM instance for workerId ${workerId}:`, error);
    throw error;
  }
}

export async function getOrCreateWorkerInstance(
  workerId: string,
  workerType: 'agent-core' | 'ec2' = 'ec2'
): Promise<{ instanceId: string; oldStatus: 'stopped' | 'terminated' | 'running' }> {
  // For agent-core runtime, return immediately (local execution)
  if (workerType === 'agent-core') {
    console.log(`Using agent-core runtime for workerId ${workerId}`);
    return { instanceId: 'local', oldStatus: 'running' };
  }

  // Check if a VM instance with this workerId already exists
  const existingVM = await findWorkerVMInstance(workerId);

  if (existingVM) {
    const status = await getVMInstanceStatus(existingVM);

    if (status === 'running' || status === 'starting') {
      console.log(`VM instance ${existingVM} is already running for workerId ${workerId}`);
      return { instanceId: existingVM, oldStatus: 'running' };
    }

    if (status === 'deallocated' || status === 'stopped') {
      console.log(`Starting stopped VM instance ${existingVM} for workerId ${workerId}`);
      await updateInstanceStatus(workerId, 'starting');
      await startVMInstance(existingVM);
      return { instanceId: existingVM, oldStatus: 'stopped' };
    }
  }

  // No existing instance found, create a new one
  console.log(`Creating new VM instance for workerId ${workerId}`);
  await updateInstanceStatus(workerId, 'starting');
  const { instanceId } = await createVMInstance(workerId);
  return { instanceId, oldStatus: 'terminated' };
}
