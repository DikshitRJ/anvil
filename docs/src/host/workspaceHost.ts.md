# `src/host/workspaceHost.ts`

**Purpose**
This file implements the `WorkspaceHost` interface using the VS Code API. It provides functionality for reading files, listing files, and retrieving diagnostics while ensuring path safety. It delegates write operations and command execution to a provided delegate object.

**Exports**
* HostDelegates (interface): Defines the required methods for write operations and command execution.
* SEVERITY (const): Maps VS Code diagnostic severities to string labels.
* VsCodeWorkspaceHost (class): Implements the `WorkspaceHost` interface for VS Code environments.

**Collaborators**
* Imports:
    * `node:path`: Used for path separator handling.
    * `vscode`: Used for workspace file system access, text documents, and diagnostics.
    * `../core/context/codeIndex`: Provides the `CodeIndex` type.
    * `../core/paths`: Provides `resolveInWorkspace` and `toRelative` for path manipulation.
    * `../mcp/server`: Provides the `DiagnosticInfo` and `WorkspaceHost` types.
    * `../core/fileList`: Provides `filterFiles` for listing files.
    * `./realPath`: Provides `assertRealPathInside` to guard against symlink escapes.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `readFile` checks if a file is currently open in a text document before attempting a file system read.
* `readFile` calls `assertRealPathInside` to ensure the resolved path remains within the workspace root.
* `listFiles` defaults to a limit of 200 files.
* `inRoot` validates that a path starts with the workspace root followed by a path separator.
* `diagnostics` converts 0-indexed line numbers from VS Code to 1-indexed numbers.
* `diagnostics` filters out any diagnostics that are not on the `file` scheme or are outside the workspace root.
* `SEVERITY` maps `vscode.DiagnosticSeverity.Hint` to the string `'info'`.

**Notes**
* `readFile` returns `null` if the file system read fails.
* `diagnostics` returns an empty array if no files match the criteria or if the provided relative path is invalid.
* `applyWrite` and `runCommand` are delegated to the `delegates` object provided during construction.
