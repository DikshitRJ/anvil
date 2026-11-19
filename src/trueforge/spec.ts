import type { TrueForgeApi } from '@truefoundry/trueforge-sdk';

// Note: agent/*.json use the snake_case wire format (mcp_servers, ...) while TrueForgeApi.AgentSpec is the SDK's
// camelCase request type; buildSpec/loadAgentDefinitions are responsible for any conversion.
export interface AgentDefinition {
  name: string;
  description: string;
  manifest: TrueForgeApi.AgentSpec;
}

export function buildSpec(_def: AgentDefinition, _model: string): AgentDefinition['manifest'] {
  throw new Error('not implemented');
}

// imports the JSON files from agent/
export function loadAgentDefinitions(): { coder: AgentDefinition; inline: AgentDefinition } {
  throw new Error('not implemented');
}
