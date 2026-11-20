# `src/core/context/codeIndex.ts`

**Purpose**
In-memory index of the workspace: file contents, symbols, chunks, BM25 search, import graph, grep, and a repository map.

**Exports**
- `CodeIndex(root)`: `build(onProgress?)`, `updateFile`, `removeFile`, `files`, `getContent`, `symbolsOf`, `chunksOf`, `search`, `findSymbol`, `grep` (+ `grepTruncated` flag), `neighbors`, `repoMap`.

**Collaborators**
- Imports: `node:fs`, `node:path`, `picomatch`, `assemble` (`estimateTokens`), `bm25`, `chunker`, `imports`, `symbols`, `tokenize`, `types`, `walker`.
- Used by: `assemble.ts`, `rank.ts`, `host/indexService.ts`, MCP tools.

**Key behaviour and invariants**
- `build` walks the workspace and reads files with 32 workers. Files that fail to read, or contain a NUL byte in the first 8 KB (binary), are skipped. `onProgress(done, total)` is called per file.
- `updateFile` removes the old entry first, then indexes symbols, chunks, path tokens and imports; BM25 text weights path tokens twice and symbol tokens three times. `removeFile` clears every map and the BM25 entries. Both invalidate the cached import graph.
- `search(query, k = 10)`: BM25 over chunks, x1.25 if a query token is in the path, x1.4 if the chunk symbol's last segment is an identifier-like word in the query; ties by chunk id; at most 3 hits per file.
- `findSymbol(name, kind?)`: staged matching (exact, case-insensitive, qualified suffix, prefix, substring) stopping once 20 are found; returns at most 20.
- `grep(pattern, {glob, limit = 100, ignoreCase})`: model patterns that are invalid or contain a nested quantifier fall back to a literal search (ReDoS guard). Scanning stops at 200,000 lines or 200 ms (checked every 1000 lines) and sets `grepTruncated`. Lines are trimmed and cut to 200 chars.
- `neighbors(rel)`: sorted 1-hop imports in both directions; graph built lazily and cached.
- `repoMap({maxTokens = 1500, focus})`: header with file count, a directory tree (top 2 levels with file counts), then top-level symbol signatures (each cut to 120 chars) of focus files (default: the 10 files with most top-level symbols); output is cut line by line at the token budget.

**Notes**
- Content is held in memory; only text files are indexed.
