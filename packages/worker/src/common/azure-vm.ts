/**
 * Azure VM 停止機能
 * Azure Instance Metadata Service (IMDS) を使用して VM 情報を取得
 */
import { ComputeManagementClient } from '@azure/arm-compute';
import { DefaultAzureCredential } from '@azure/identity';

const workerRuntime = process.env.WORKER_RUNTIME ?? 'azure-vm';

let computeClient: ComputeManagementClient | null = null;

const getComputeClient = () => {
  if (!computeClient) {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    if (!subscriptionId) {
      throw new Error('AZURE_SUBSCRIPTION_ID must be set');
    }
    computeClient = new ComputeManagementClient(new DefaultAzureCredential(), subscriptionId);
  }
  return computeClient;
};

export const stopMyself = async () => {
  if (workerRuntime !== 'azure-vm') return;

  try {
    const { resourceGroupName, vmName } = await getVMInfo();
    const client = getComputeClient();

    console.log(`Stopping VM: ${vmName} in resource group: ${resourceGroupName}`);
    await client.virtualMachines.beginDeallocateAndWait(resourceGroupName, vmName);
    console.log('VM stopped successfully');
  } catch (error) {
    console.error('Failed to stop VM:', error);
    throw error;
  }
};

/**
 * Azure Instance Metadata Service (IMDS) から VM 情報を取得
 * https://learn.microsoft.com/en-us/azure/virtual-machines/instance-metadata-service
 */
const getVMInfo = async (): Promise<{ resourceGroupName: string; vmName: string }> => {
  const res = await fetch('http://169.254.169.254/metadata/instance?api-version=2021-02-01', {
    headers: {
      Metadata: 'true',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get VM metadata: ${res.statusText}`);
  }

  const metadata = await res.json();

  return {
    resourceGroupName: metadata.compute.resourceGroupName,
    vmName: metadata.compute.name,
  };
};
