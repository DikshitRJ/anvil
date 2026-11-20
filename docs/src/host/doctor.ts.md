# `src/host/doctor.ts`

**Purpose**
This file performs a series of diagnostic checks on the TrueForge environment, MCP bridge, registrations, models, and index. It generates a report to identify configuration issues or connectivity problems. The file is designed to never throw errors during the check process.

**Exports**
* DoctorDeps (interface): Defines the dependencies required for running diagnostics.
* OUTBOUND_HINT (const): A string providing instructions for allowing loopback hosts.
* runChecks(d: DoctorDeps): Returns a list of Check objects by executing all diagnostic functions.
* formatReport(checks: Check[]): Returns a formatted string representation of the diagnostic results.

**Collaborators**
* Imports:
    * `@modelcontextprotocol/sdk/client/index.js`: Provides the Client for bridge communication.
    * `@modelcontextprotocol/sdk/client/streamableHttp.js`: Provides the transport for the MCP bridge.
    * `@truefoundry/trueforge-sdk`: Provides the TrueForge client type.
    * `../core/config`: Provides the AnvilConfig type.
    * `../trueforge/client`: Provides the checkHealth function.
    * `../trueforge/setup`: Provides the MCP_SERVER_NAME constant.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `guard` function catches all errors in check functions and returns a `Check` object with `ok: false`.
* `checkBridge` considers the bridge healthy if it returns at least 10 tools.
* `checkBridge` treats `bridgeState === 'elsewhere'` as a warning (`warn: true`) rather than a failure.
* `checkRegistered` validates that the URL in TrueForge settings matches the `bridgeUrl`.
* `checkAgents` verifies that both `anvil-coder` and `anvil-inline` are registered.
* `checkModels` verifies that all models in `d.cfg.models` exist in the TrueForge model list.
* `checkIndex` considers the index ready only if `indexReady` is true and `indexedFiles` is greater than 0.
* `runChecks` skips registration, agent, and model checks if the TrueForge reachability check fails.

**Notes**
* The `msg` helper converts non-Error objects to strings.
* `client.close()` in `checkBridge` catches errors and returns `undefined`.
* `formatReport` uses `⚠` for warnings, `✓` for success, and `✗` for failures.
* `OUTBOUND_HINT` specifically addresses loopback blocks for `127.0.0.1` and `localhost`.
