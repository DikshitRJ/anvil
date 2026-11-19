// Idempotent first-run setup: registers the Anvil MCP server and the agent definitions in TrueForge.
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { AgentDefinition } from './spec';

export const MCP_SERVER_NAME = 'anvil-editor';

export interface SetupReport {
  mcpServer: 'created' | 'updated' | 'failed';
  agents: Record<string, 'ok' | 'failed'>;
  errors: string[];
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function upsertAgent(client: TrueForge, def: AgentDefinition): Promise<void> {
  const { name, description, manifest } = def;
  for await (const agent of await client.agents.list({ agentName: name })) {
    if (agent.name === name) {
      await client.agents.update(agent.id, { description, manifest });
      return;
    }
  }
  await client.agents.create({ name, description, manifest });
}

export async function ensureSetup(
  client: TrueForge,
  opts: { mcpUrl: string; token: string; agents: AgentDefinition[]; serverName?: string },
): Promise<SetupReport> {
  const report: SetupReport = { mcpServer: 'created', agents: {}, errors: [] };
  const serverName = opts.serverName ?? MCP_SERVER_NAME;
  try {
    const existed = await client.settings.mcpServers.get(serverName).then(
      () => true,
      () => false,
    );
    await client.settings.mcpServers.createOrUpdate({
      manifest: {
        type: 'remote',
        name: serverName,
        url: opts.mcpUrl,
        description: 'Anvil VS Code editor tools: read, search, review-gated edits and commands',
        auth: { type: 'header', headers: { Authorization: `Bearer ${opts.token}` } },
      },
    });
    report.mcpServer = existed ? 'updated' : 'created';
  } catch (e) {
    report.mcpServer = 'failed';
    report.errors.push(`mcp server: ${errText(e)}`);
  }
  for (const def of opts.agents) {
    try {
      await upsertAgent(client, def);
      report.agents[def.name] = 'ok';
    } catch (e) {
      report.agents[def.name] = 'failed';
      report.errors.push(`agent ${def.name}: ${errText(e)}`);
    }
  }
  return report;
}
