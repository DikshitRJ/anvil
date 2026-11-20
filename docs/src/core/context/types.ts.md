# `src/core/context/types.ts`

**Purpose**
Shared type definitions for the code index and context assembly. No runtime code.

**Exports**
- `SymbolInfo`: `name`, `kind` (`class function method variable interface type heading module`), `path`, 1-based `line`/`endLine`, optional `container`, `signature`.
- `Chunk`: `id`, `path`, `startLine`, `endLine`, `text`, optional `symbol`.
- `SearchHit`: `chunk`, `score`, `matched`.
- `Mention`: `kind` (`file` | `symbol`), `value`, `raw`.
- `ContextSignals`: `query`, `mentions`, optional `activeFile` and `selection {path, startLine, endLine, text}`, `openFiles`, `recentFiles`.
- `ContextItem`: `path`, optional lines, `kind` (`pinned selection symbol chunk repo-map`), `reason`, `score`, `tokens`, `text`.
- `ContextPack`: `items`, `budget`, `used`, `dropped` (`{path, reason}[]`).

**Collaborators**
- Imports: none.
- Used by: every file in `core/context/`.

**Key behaviour and invariants**
- `ContextPack.used` is the estimated tokens of all items; items that did not fit are listed in `dropped`.
- Every `ContextItem` carries a human-readable `reason` shown to the model.

**Notes**
- `repo-map` items have no line range.
