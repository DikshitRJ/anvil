# `src/host/workspaceHost.ts`

**Purpose**
VS Code implementation of the MCP `WorkspaceHost`: open-buffer-aware reads with a symlink-escape guard, index-based file listing and diagnostics. Writes and commands are delegated.

**Exports**
- `HostDelegates`: `applyWrite(rel, content, summary)` and `runCommand`.
- `VsCodeWorkspaceHost(root, getIndex, delegates)`: `root`, `index`, `readFile`, `listFiles`, `diagnostics`, `applyWrite`, `runCommand`.

**Collaborators**
- Imports: `node:path`, `vscode`, `CodeIndex` (type), `../core/paths`, `../core/fileList` (`filterFiles`), `../mcp/server` (`DiagnosticInfo`, `WorkspaceHost` types), `./realPath`.
- Used by: `extension.ts` (passed to the MCP bridge), `mcp/tools.ts`.

**Key behaviour and invariants**
- `readFile(rel)`: lexical check (`resolveInWorkspace`, throws `PathError` for escapes) then `assertRealPathInside` (symlinks); returns the text of an open editor (unsaved edits included) or the file from disk, or `null` if it cannot be read.
- `listFiles(dir, glob, limit = 200)` filters the code index's file list, so it only shows indexed files (no binaries, ignored or oversized files) and never touches the disk.
- `diagnostics(rel?)`: for one file (path validated, so an invalid path throws) or the whole workspace; only `file:` URIs inside the root are kept. Lines are 1-based; Error/Warning map to `error`/`warning`, Information and Hint map to `info`.
- `applyWrite` and `runCommand` simply forward to the delegates (the run controller), which is where review, run-active checks and checkpoints happen.

**Notes**
- The severity map is a private constant, not an export.
