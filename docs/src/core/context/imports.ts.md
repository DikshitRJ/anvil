# `src/core/context/imports.ts`

**Purpose**
Extracts and resolves imports (Python, TS/JS) for the 1-hop import graph.

**Exports**
- `ImportSpec`: `dots` (Python relative level, 0 = absolute), `module`, `names` (Python `from m import a, b`).
- `extractImports(rel, content)`: regex extraction chosen by file extension.
- `resolveImports(rel, specs, known)`: indexed files that `rel` imports.

**Collaborators**
- Imports: `node:path`.
- Used by: `codeIndex.ts`.

**Key behaviour and invariants**
- `.py` files use Python `from x import y` and `import a, b` line patterns; `.ts .tsx .js .jsx .mjs .cjs` files only extract relative specifiers (starting with `.`) from `from`, `import(...)` and `require(...)`. Bare package imports are ignored. Other extensions give `[]`.
- Python candidates: `module.py` and `module/__init__.py` (plus `module/<name>.py` for imported names), searched from the importing file's directory for relative imports, or from the root and `src/` for absolute ones.
- JS candidates: the path as written (if it has a known extension), then each extension appended, then `index.<ext>` in that directory.
- Only paths in `known` are returned, and never the importing file itself; results are de-duplicated.

**Notes**
- Heuristic, line based; it does not handle multi-line TS imports whose specifier is on a different line than a `from`-less form, or aliased path mappings.
