# `src/trueforge/setup.ts`

**Purpose**
Idempotent first-run setup: registers the Anvil MCP server and the agent definitions in TrueForge.

**Exports**
- `MCP_SERVER_NAME` (`'anvil-editor'`).
- `SetupReport`: `mcpServer` (`created | updated | failed`), `agents` (name to `ok | failed`), `errors`.
- `ensureSetup(client, {mcpUrl, token, agents, models, serverName?})`.

**Collaborators**
- Imports: TrueForge SDK type, `./spec` (`buildSpec`, `AgentDefinition`).
- Used by: `extension.ts` (`anvil.setup`, health loop), `host/doctor.ts` (`MCP_SERVER_NAME`).

**Key behaviour and invariants**
- MCP server: checks whether `anvil-editor` exists, then `createOrUpdate` with a `remote` manifest pointing at the bridge URL and an `Authorization: Bearer <token>` header (so the bridge's token check passes). Reported as `updated` if it existed, else `created`; failure sets `failed` and records the error.
- Agents: each definition is built with the first model in `models` (`models[0]`) and upserted by name: an existing agent with exactly that name is updated (description and manifest), otherwise created. With no models configured every agent fails with "Set anvil.models to register agents".
- Never throws: each step's error is caught into `errors`; one failure does not stop the others.

**Notes**
- Only the first configured model is written into the agent manifests; later models are applied per session by `AnvilSession` when falling back.
