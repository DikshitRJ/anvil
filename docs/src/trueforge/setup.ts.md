# `src/trueforge/setup.ts`

**Purpose**
This file configures the TrueForge environment. It registers the Anvil MCP server and creates or updates agent definitions.

**Exports**
* MCP_SERVER_NAME: string - constant. It holds the value 'anvil-editor'.
* SetupReport: interface. It defines the structure for the setup result.
* ensureSetup(client: TrueForge, opts: { mcpUrl: string; token: string; agents: AgentDefinition[]; serverName?: string }): Promise<SetupReport> - function. It configures the MCP server and all provided agents.

**Collaborators**
* Imports: @truefoundry/trueforge-sdk, ./spec.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function `ensureSetup` is idempotent.
* It updates an existing agent if the name matches.
* It creates a new agent if the name does not exist.
* It catches errors for each agent and continues the loop.
* It uses `MCP_SERVER_NAME` as the default server name if no name is provided.

**Notes**
* The `errText` helper converts unknown errors to strings.
