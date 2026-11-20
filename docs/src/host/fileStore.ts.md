# `src/host/fileStore.ts`

**Purpose**
`FileStore` implementation over the VS Code workspace. Writes go through `WorkspaceEdit` so VS Code's native undo works and unsaved buffers are respected.

**Exports**
- `VsCodeFileStore(root)`: `read(rel)`, `write(rel, content)`, `remove(rel)`.

**Collaborators**
- Imports: `node:path`, `vscode`, `../core/paths` (`resolveInWorkspace`), `../core/transaction` (`FileStore` type).
- Used by: `runController.ts` (writes and the checkpoint store). Note it does not do the symlink check (`realPath.ts`); reads by agent tools do.

**Key behaviour and invariants**
- All paths go through `resolveInWorkspace`, so an escaping path throws `PathError`.
- `read` returns the text of an open editor (including unsaved edits) when the file is open, otherwise the file from disk, or `null` if it cannot be read.
- `write`: a missing file (`read` is `null`) gets its directory created and is created via `WorkspaceEdit.createFile` (`ignoreIfExists`). An existing file whose content differs is replaced over its full range via `WorkspaceEdit.replace`; identical content is a no-op. Afterwards, if the document is open and dirty, it is saved.
- `remove` deletes via `WorkspaceEdit.deleteFile` with `ignoreIfNotExists`.

**Notes**
- `read` reflects the editor buffer, which is what `CheckpointStore` compares against when detecting user edits (conflicts).
