# `src/host/doctor.ts`

**Purpose**
Diagnostics behind the `anvil.doctor` command: checks TrueForge, the MCP bridge, registrations, models and the index, and formats a report. It never throws.

**Exports**
- `DoctorDeps`: `cfg`, `client`, `bridgeUrl`, optional `bridgeState` (`ok | elsewhere | failed`), `token`, `indexedFiles`, `indexReady`.
- `Check`: `name`, `ok`, `detail`, optional `fix`, `setup` (running setup would fix it), `warn`.
- `OUTBOUND_HINT`: tells the user to start TrueForge with `OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]'` because loopback is blocked by default.
- `runChecks(deps)`, `formatReport(checks)`.

**Collaborators**
- Imports: MCP SDK `Client` and `StreamableHTTPClientTransport`, TrueForge SDK type, `core/config` (type), `trueforge/client` (`checkHealth`), `trueforge/setup` (`MCP_SERVER_NAME`).
- Used by: `extension.ts`.

**Key behaviour and invariants**
- Checks, in order: TrueForge reachable, MCP bridge, bridge registered in TrueForge, agents registered, models configured, code index.
- `guard` turns any thrown error into a failed check with the error message. If TrueForge is unreachable, the registration, agents and models checks are reported as failed with "skipped (TrueForge unreachable)" instead of running.
- Bridge: connects to the bridge with the bearer token and lists tools; healthy only with at least 10 tools. `bridgeState === 'elsewhere'` is `ok` with `warn` (another window owns the port); no bridge URL is a failure.
- Registration: the URL stored for the MCP server in TrueForge must equal the running bridge URL (`setup: true` otherwise). Agents: both `anvil-coder` and `anvil-inline` must exist. Models: `anvil.models` must be non-empty and every entry must match a TrueForge model `name` or `modelId` (lists up to 20 available names otherwise).
- Index: ok only if ready and more than 0 files.
- `formatReport` prefixes `✓`, `⚠` (ok with warning) or `✗`, adding a `fix:` (or `hint:` for warnings) line when available.

**Notes**
- The bridge test client is always closed, ignoring close errors.
