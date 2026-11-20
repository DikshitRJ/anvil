# `webview/main.ts`

**Purpose**
Webview entry point: wires host messages to the state reducer and renderer, and DOM events to typed `WebviewToHost` messages.

**Exports**
- None (side-effect entry script, bundled to `dist/webview.js`).

**Collaborators**
- Imports: `../src/panel/protocol` (types), `./render` (`mount`, `render`, `recordToggle`, `Refs`), `./state` (`reduce`, `initialState`, `PanelState`).
- Used by: loaded by `src/panel/panelProvider.ts`.

**Key behaviour and invariants**
- State is the pure result of `reduce(state, hostMessage)`; every update re-renders and persists via `vscode.setState`, keeping only the last 20 runs.
- `restore()` reloads saved state only if it has a `runs` array (otherwise `initialState()`); it always resets `running` to false and clears the mention list, because a reloaded webview cannot still be mid-run (the host replays `init`, `health`, `changes` on `ready`).
- Composer: Enter sends (Shift+Enter inserts a newline), nothing is sent while a run is active or the text is empty; Escape while running posts `cancel`. The textarea auto-grows to at most 8 line heights. IME composition keys are ignored.
- Mentions: an `@token` at the caret (preceded by start or whitespace) triggers a `mentionQuery` after a 120 ms debounce; results are shown only if their `query` still equals the current token (stale results are hidden). Arrow keys move, Enter/Tab insert (`@path` or `@#symbol` plus a space), Escape closes, a mouse click inserts.
- Buttons use delegated `data-action` clicks mapped to messages: `send`, `cancel`, `newChat`, `doctor`, `openSession`, `approve` (id, allow), `openFile` (path, line), `undoChange` (seq), `revertRun` (runId), `notice-action`. `<details>` open/close is recorded so it survives re-render.
- Sends `ready` on startup, which makes the host flush its queue and replay state.

**Notes**
- No business logic lives here; approvals and reverts are decided by the host.
