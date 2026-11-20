# `src/core/context/walker.ts`

**Purpose**
Async workspace walk that lists indexable files, honouring default ignores and nested `.gitignore` files.

**Exports**
- `walkWorkspace(root, opts?)`: `Promise<string[]>` of sorted workspace-relative POSIX paths; `opts.maxFileBytes` (default 512 KB) and `opts.extraIgnores` (gitignore-style patterns).

**Collaborators**
- Imports: `node:fs`, `node:path`, `ignore`.
- Used by: `codeIndex.ts`.

**Key behaviour and invariants**
- Stops after 20,000 files.
- Skips directories such as `.git node_modules dist build out .venv venv __pycache__ coverage .next target vendor .idea .claude` and `*.egg-info`.
- Skips lock files (npm, yarn, pnpm, poetry, Cargo, uv), `*.min.js`, `*.map`, and binary extensions (images including svg, archives, fonts, media, compiled artifacts, databases).
- Each directory's `.gitignore` is loaded when the walk enters it; a path is ignored if any `.gitignore` on the way (matched relative to its own directory) or `extraIgnores` matches. Unreadable directories and missing `.gitignore` files are skipped silently.
- Files over the size limit are dropped. Only regular files and directories are visited (no symlinks).

**Notes**
- Binary detection by NUL byte is done later in `CodeIndex.build`, not here.
