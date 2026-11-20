# `src/host/realPath.ts`

**Purpose**
Symlink-escape guard that complements the purely lexical check in `core/paths.ts`.

**Exports**
- `assertRealPathInside(root, abs)`: async; throws `PathError` if `abs` really resolves outside `root`.

**Collaborators**
- Imports: `node:fs/promises`, `node:path`, `../core/paths` (`PathError`).
- Used by: `workspaceHost.ts`.

**Key behaviour and invariants**
- Resolves the real path of `root`, then of `abs`. If `abs` does not exist yet (e.g. a new file), it walks up to the nearest existing ancestor and checks that one, so creating a file through a symlinked directory is also caught.
- Escape means the relative path from the real root is `..`, starts with `..` plus the separator, or is absolute: it throws `Path escapes the workspace via symlink`.
- Errors other than `PathError` (missing paths) only move the check to the parent; reaching the filesystem root without finding an existing path returns without error.

**Notes**
- Check-then-use: it does not prevent a symlink swap after the check.
