# `src/host/fileStore.ts`

**Purpose**
This file implements the `FileStore` interface for the VS Code workspace. It manages file operations such as reading, writing, and deleting files using `WorkspaceEdit` to ensure native undo support and dirty-buffer awareness.

**Exports**
* VsCodeFileStore (class): Implements the `FileStore` interface to manage workspace files.

**Collaborators**
* Imports: 
    * `node:path`: Used for retrieving the directory name of a file path.
    * `vscode`: Used for workspace filesystem access, text document management, and applying workspace edits.
    * `../core/paths`: Provides `resolveInWorkspace` to map relative paths to absolute paths.
    * `../core/transaction`: Provides the `FileStore` type definition.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `uri` method converts a relative path into a `vscode.Uri` using `resolveInWorkspace` and the instance `root`.
* The `read` method returns the text of an open document if it exists in `vscode.workspace.textDocuments`, otherwise it reads from the filesystem.
* The `write` method creates a directory if the file does not exist before creating the file via `WorkspaceEdit`.
* The `write` method uses `WorkspaceEdit.replace` if the file exists and the content differs from the current content.
* The `write` method calls `doc.save()` if the document is found in the open documents list and `isDirty` is true.
* The `remove` method uses `WorkspaceEdit.deleteFile` with `ignoreIfNotExists: true`.

**Notes**
* The `read` method returns `null` if the file cannot be read from the filesystem.
* `WorkspaceEdit` is used for both creation and replacement to maintain native undo history.
* `createFile` uses `ignoreIfExists: true`.
