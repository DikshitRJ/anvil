# `src/core/paths.ts`

**Purpose**
Pure path guard that keeps tool paths inside the workspace root.

**Exports**
- `PathError` (class, extends `Error`): thrown for invalid or escaping paths.
- `resolveInWorkspace(root, p)`: returns an absolute path inside `root`.
- `toRelative(root, abs)`: returns a workspace-relative path with `/` separators.

**Collaborators**
- Imports: `node:path`.
- Used by: the MCP tools, inline edit, workspace host.

**Key behaviour and invariants**
- Throws `PathError` if `p` contains a NUL character.
- Backslashes become `/`; leading `./` segments are stripped.
- Empty or `.` resolves to the root itself.
- Throws `PathError` if the resolved path is `..`, starts with `../`, or is absolute relative to the root (this includes absolute paths outside the root).
- `toRelative` returns `.` for the root.

**Notes**
- Symlink `realpath` checks are not done here; the host does them (see `host/realPath.ts`).
