import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { AgentDefinition } from './spec';

export const MCP_SERVER_NAME = 'anvil-editor';

export interface SetupReport {
  mcpServer: 'created' | 'updated' | 'failed';
  agents: Record<string, 'ok' | 'failed'>;
  errors: string[];
}

export async function ensureSetup(
  _client: TrueForge,
  _opts: { mcpUrl: string; token: string; agents: AgentDefinition[]; serverName?: string },
): Promise<SetupReport> {
  throw new Error('not implemented');
}
