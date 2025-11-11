import { getSession } from '@remote-swe-agents-azure/agent-core/lib';

/**
 * Set required global variables for the session
 */
export const refreshSession = async (workerId: string) => {
  const session = await getSession(workerId);
  if (!session) return;

  // Session loaded successfully
};
