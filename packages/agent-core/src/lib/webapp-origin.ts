import { getSecret } from './azure/keyvault';

/**
 * Get the webapp origin URL from Key Vault
 * Uses the WEBAPP_ORIGIN_SECRET_NAME environment variable
 * @returns The webapp origin URL or undefined if not available
 */
export const getWebappOrigin = async (): Promise<string | undefined> => {
  // First try to use the environment variable if it's set
  const secretName = process.env.WEBAPP_ORIGIN_SECRET_NAME;

  if (secretName) {
    const origin = await getSecret(secretName);
    return origin;
  }
};

/**
 * Build webapp session URL for a worker
 * @param workerId The worker ID
 * @returns The session URL or undefined if webapp origin is not available
 */
export const getWebappSessionUrl = async (workerId: string): Promise<string | undefined> => {
  const origin = await getWebappOrigin();

  if (!origin) {
    return undefined;
  }

  return `${origin}/sessions/${workerId}`;
};
