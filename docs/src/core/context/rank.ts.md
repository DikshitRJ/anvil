# `src/core/context/rank.ts`

**Purpose**
Candidate generation and weighted Reciprocal Rank Fusion (RRF) that ranks chunks for the context pack.

**Exports**
- `pathPrior(path)`, `Candidate` (`chunk`, `score`, `reasons`), `chunkRelevance(chunk, queryTokens)`, `rankedChunks(index, path, q)`, `chunkAt(index, path, line)`, `identifiers(query)`, `rankCandidates(index, signals)`.

**Collaborators**
- Imports: `CodeIndex` (type), `tokenize`, `types`.
- Used by: `assemble.ts`.

**Key behaviour and invariants**
- `pathPrior` down-weights unlikely edit targets: CHANGES/CHANGELOG/HISTORY 0.3; `.devcontainer/.github/.circleci` 0.5; config-like data (json/toml/yaml/cfg/ini) under `test(s)/` or `static/` 0.5; `examples/samples` 0.6; root dotfile configs/rc/ignore 0.5; otherwise 1.
- `chunkRelevance` counts distinct query-token hits: body match 1, symbol-name match 2. `rankedChunks` sorts by it, ties by original order.
- `identifiers` returns backticked tokens plus snake_case or camelCase words from the query.
- Signals fused with RRF (`weight / (60 + rank + 1)`): BM25 top 30 (1.0), exact-name symbol matches for identifiers (1.0), path matches (0.6), editor files (active, open, recently edited; 0.5), import neighbours of the top 3 files, capped at 15 (0.4). Each file signal contributes the file's best chunk.
- Path matching weights tokens by `ln(1 + n/df)`, ignores tokens present in more than 10% of paths (cutoff skipped when fewer than 50 files) and keeps the top 20.
- The final score is multiplied by `pathPrior`; ties break by chunk id. Reasons from every contributing signal are kept for the item's "reason".

**Notes**
- Pure and deterministic for a given index and signals.
