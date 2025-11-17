import { CustomAgent, EmptyMcpConfig, mcpConfigSchema } from '../schema';
import { getContainer, ContainerName } from './azure';
import { randomBytes } from 'crypto';
import z from 'zod';

const CONTAINER_NAME = ContainerName;

const validateMcpConfig = (mcpConfig: string): void => {
  try {
    const parsedMcpConfig = JSON.parse(mcpConfig);
    mcpConfigSchema.parse(parsedMcpConfig);
  } catch (error) {
    throw new Error(`Invalid mcpConfig: ${error instanceof Error ? error.message : 'Invalid JSON or schema'}`);
  }
};

export const getCustomAgent = async (customAgentId: string | undefined): Promise<CustomAgent | undefined> => {
  if (!customAgentId) return undefined;

  const container = getContainer(CONTAINER_NAME);
  const PK = 'custom-agent';
  const id = `${PK}#${customAgentId}`;

  try {
    const { resource: item } = await container.item(id, PK).read();
    return item as CustomAgent | undefined;
  } catch (error: any) {
    if (error.code === 404) {
      return undefined;
    }
    throw error;
  }
};

export const getCustomAgents = async (limit: number = 50): Promise<CustomAgent[]> => {
  const container = getContainer(CONTAINER_NAME);
  const PK = 'custom-agent';

  const querySpec = {
    query: 'SELECT * FROM c WHERE c.PK = @pk ORDER BY c.createdAt DESC',
    parameters: [{ name: '@pk', value: PK }],
  };

  const { resources: items } = await container.items.query(querySpec, { maxItemCount: limit }).fetchAll();

  const agents = (items as CustomAgent[]).map((agent) => ({
    ...agent,
    mcpConfig: JSON.stringify(JSON.parse(agent.mcpConfig), undefined, 2),
  })) satisfies CustomAgent[];

  return agents;
};

export const createCustomAgent = async (
  agent: Omit<CustomAgent, 'id' | 'PK' | 'SK' | 'createdAt' | 'updatedAt'>
): Promise<CustomAgent> => {
  if (!agent.mcpConfig) {
    agent.mcpConfig = JSON.stringify(EmptyMcpConfig);
  }
  validateMcpConfig(agent.mcpConfig);

  const now = Date.now();
  const SK = `${randomBytes(6).toString('base64url')}`;
  const PK = 'custom-agent';
  const id = `${PK}#${SK}`;

  const customAgent: CustomAgent = {
    ...agent,
    id,
    PK,
    SK,
    createdAt: now,
    updatedAt: now,
  };

  const container = getContainer(CONTAINER_NAME);
  await container.items.create(customAgent);

  return customAgent;
};

export const updateCustomAgent = async (
  sk: string,
  updates: Omit<CustomAgent, 'id' | 'PK' | 'SK' | 'createdAt' | 'updatedAt'>
): Promise<CustomAgent> => {
  if (!updates.mcpConfig) {
    updates.mcpConfig = JSON.stringify({ mcpServers: {} } satisfies z.infer<typeof mcpConfigSchema>);
  }
  validateMcpConfig(updates.mcpConfig);

  const now = Date.now();
  const container = getContainer(CONTAINER_NAME);
  const PK = 'custom-agent';
  const id = `${PK}#${sk}`;

  const { resource: existingAgent } = await container.item(id, PK).read();

  if (!existingAgent) {
    throw new Error(`Custom agent with SK ${sk} not found`);
  }

  const updatedAgent: CustomAgent = {
    ...existingAgent,
    ...updates,
    PK,
    SK: sk,
    id,
    createdAt: existingAgent.createdAt,
    updatedAt: now,
  };

  const { resource: result } = await container.item(id, PK).replace(updatedAgent);
  return result as CustomAgent;
};

export const deleteCustomAgent = async (sk: string): Promise<void> => {
  const container = getContainer(CONTAINER_NAME);
  const PK = 'custom-agent';
  const id = `${PK}#${sk}`;

  await container.item(id, PK).delete();
};
