# `src/extension.ts`

**Purpose**
This file serves as the composition root for the Anvil extension. It initializes the core services, wires together the MCP bridge, TrueForge client, and UI components. It manages the extension lifecycle, including activation, deactivation, and command registration.

**Exports**
* activate(context: vscode.ExtensionContext): Promise<void> : function : Initializes the extension, boots the core services, and registers providers.
* deactivate(): Promise<void> : function : Shuts down the extension, closes the bridge, and disposes of resources.

**Collaborators**
* Imports:
    * `node:crypto`: Used to generate a random 32-byte hex token for the MCP bridge.
    * `vscode`: Provides the core VS Code API for commands, output channels, and webview providers.
    * `@truefoundry/trueforge-sdk`: Provides the `TrueForge` type for the client.
    * `./core/config`: Provides `AnvilConfig` type and `readConfig` function.
    * `./core/paths`: Provides `toRelative` for path normalization.
    * `./host/commandRunner`: Provides `CommandRunner` for executing commands.
    * `./host/config`: Provides `onConfigChange` and `readConfig`.
    * `./host/doctor`: Provides `formatReport` and `runChecks`.
    * `./host/healthLoop`: Provides `HealthLoop` for periodic health checks.
    * `./host/indexService`: Provides `IndexService` for file indexing.
    * `./host/inlineEdit`: Provides `cancelActiveInlineEdit` and `registerInlineEdit`.
    * `./host/reviewController`: Provides `ReviewController`.
    * `./host/runController`: Provides `RunController`.
    * `./host/statusBar`: Provides `AnvilStatusBar`.
    * `./host/workspaceHost`: Provides `VsCodeWorkspaceHost`.
    * `./mcp/server`: Provides `startBridge` to initialize the MCP bridge.
    * `./panel/panelProvider`: Provides `PanelProvider` for the webview panel.
    * `./panel/protocol`: Provides `HostToWebview` type.
    * `./trueforge/client`: Provides `checkHealth` and `createClient`.
    * `./trueforge/setup`: Provides `ensureSetup`.
    * `./trueforge/spec`: Provides `loadAgentDefinitions`.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The extension requires a workspace folder to boot; otherwise, it registers "no folder" commands.
* The MCP bridge uses a port defined in `cfg.mcpPort`.
* If the bridge port is in use (`EADDRINUSE`), the bridge state is set to `elsewhere` and a notification is shown.
* The `getToken` function generates a 32-byte hex token and stores it in `anvil.mcpToken` secrets.
* `registerMissing` ensures that all `COMMANDS` and `anvil.inlineEdit` are registered to prevent dead entries in the palette.
* `onConfigChange` triggers a client recreation and session reset if `trueforgeUrl` or model configurations change.
* `inlineSession` throws an error if `cfg.models` is empty.
* `registerCommands` maps specific IDs like `anvil.cancel`, `anvil.newChat`, and `anvil.setup` to their respective controller methods.

**Notes**
* Activation errors are caught and logged to the "Anvil" output channel, followed by a notification and a "missing" registration state.
* The `bridge` is closed during deactivation, catching any errors to prevent deactivation failure.
* `registerNoFolder` uses a fire-and-forget approach for information messages to avoid blocking command execution.
* `registerInlineEdit` is initialized with a session creator that uses `defs.inline`.
