# `src/trueforge/setup.ts`

**Purpose**
This file performs an idempotent first-run setup for the TrueForge environment. It registers the Anvil MCP server and creates or updates agent definitions.

**Exports**
* MCP_SERVER_NAME (const): Defines the default name 'anvil-editor' for the MCP server.
* SetupReport (interface): Defines the structure for the setup results including server status, agent statuses, and error messages.
* ensureSetup (function): Executes the registration of the MCP server and the iteration of agent definitions.

**Collaborators**
* Imports:
    * `@truefoundry/trueforge-sdk`: Provides the `TrueForge` type for the client.
    * `./spec`: Provides `buildSpec` for manifest generation and `AgentDefinition` for type definitions.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `serverName` defaults to `MCP_SERVER_NAME` if not provided in options.
* The `mcpServers.get` call catches errors to determine if the server already exists.
* The `mcpServers.createOrUpdate` call uses a hardcoded description: 'Anvil VS Code editor tools: read, search, review-gated edits and commands'.
* The `upsertAgent` function updates an existing agent if the name matches and creates a new one otherwise.
* The `model` used for all agents is derived from the first element of the `opts.models` array.
* If `opts.models` is empty, agent registration fails with a specific error message.

**Notes**
* `errText` converts unknown errors to strings, preferring the `message` property of an `Error` instance.
* The `mcpServer` status in `SetupReport` can be 'created', 'updated', or 'failed'.
* The `agents` status in `SetupReport` can be 'ok' or 'failed'.
