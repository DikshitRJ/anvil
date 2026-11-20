# `src/core/context/chunker.ts`

**Purpose**
Splits a file into retrieval chunks aligned with symbol boundaries.

**Exports**
- `chunkFile(path, content, symbols)`: returns `Chunk[]` (`id` = `path#start-end`, `path`, `startLine`, `endLine`, `text`, optional `symbol`).
- Re-exports the `Chunk` type.

**Collaborators**
- Imports: `./types` (`Chunk`, `SymbolInfo`).
- Used by: `codeIndex.ts`.

**Key behaviour and invariants**
- A trailing empty line is dropped. With no symbols the file is cut into 60-line windows overlapping by 10 lines; all-blank windows are skipped.
- With symbols: headings are flattened (each ends before the next symbol), then non-nested top-level symbols become chunks named with their qualified name (`container.name`). A range of at most 150 lines is one chunk, longer ranges are cut into 120-line windows. Blank-only ranges give no chunk.
- Code between symbols (and before the first / after the last) becomes an unnamed chunk only if it has at least 3 non-blank lines.
- A class longer than 120 lines with methods is split: a header gap chunk, one chunk per method, and a trailing gap chunk.

**Notes**
- Line numbers are 1-based and inclusive.
