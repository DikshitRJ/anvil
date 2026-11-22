# `src/extension.ts`

**Purpose**
Composition root of the Anvil VS Code extension: wires the code index, MCP bridge, TrueForge client, run controller, panel, review, inline edit and commands, and owns activation and deactivation.

**Exports**
- `activate(context)`: creates the "Anvil" output channel and boots Anvil for the first workspace folder.
- `deactivate()`: disposes the run controller and closes the MCP bridge.

**Collaborators**
- Imports: `node:crypto`, `vscode`, the `TrueForge` SDK type, `core/config` (type), `core/paths` (`toRelative`), and the host services `CommandRunner`, `config`, `doctor`, `HealthLoop`, `IndexService`, `inlineEdit`, `ReviewController`, `RunController`, `AnvilStatusBar`, `VsCodeWorkspaceHost`, plus `mcp/server`, `panel/*`, `trueforge/client`, `trueforge/setup`, `trueforge/spec`.

**Key behaviour and invariants**
- No workspace folder: every command (the `COMMANDS` list plus `anvil.inlineEdit`) is registered to show "Open a folder to use Anvil" (fire-and-forget, so `executeCommand` is not blocked by the toast). Any activation error is logged, an error toast is shown, and `registerMissing` registers whichever contributed commands are still unregistered so the palette has no dead entries.
- The MCP token is a random 32-byte hex string kept in VS Code secrets (`anvil.mcpToken`) and reused across sessions.
- The bridge starts on `mcpPort`. On `EADDRINUSE` the state is `elsewhere` (another VS Code window serves agent tools; inline edit still works here) and `setup` does nothing in that window so it cannot overwrite the owner's URL; other failures show an error and agent tools will not work. State is shown to the panel as `bridge: ok/down`.
- `setup` (command `anvil.setup`, also triggered by the health loop) registers the MCP server, agents (coder and inline) and models in TrueForge via `ensureSetup`, logging the report and showing errors.
- `onConfigChange` updates config; a changed URL recreates the client and re-runs the health check; a changed URL, model list, retries or stall timeout resets the session via `resetSessionIfIdle` (only if no run is active). The panel gets a fresh `init` message.
- Saved `file:` documents inside the workspace are reported to `run.trackSaved` (feeds recent files for context ranking).
- `inlineSession` refuses to start with no `anvil.models` (offers "Open Settings") and otherwise opens a session with the inline agent.
- Commands: `anvil.cancel` cancels an active inline edit first, otherwise the run; `newChat`, `undoLast`, `setup`, `doctor` map to controller methods; `openSession` opens `<trueforgeUrl>/sessions/<id>`, or says there is no session yet; `focusPanel` focuses the panel view.
- `doctor` runs the checks, prints them to the "Anvil Doctor" channel, posts a notice with `id: 'doctor'` (so a re-run replaces the previous Doctor banner instead of stacking) and offers "Run setup" when a failing check is fixable by setup.

**Notes**
- The webview view provider is registered with `retainContextWhenHidden`.
