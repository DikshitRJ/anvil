# `src/core/context/rank.ts`

**Purpose**
This file implements candidate generation and weighted Reciprocal Rank Fusion (RRF) for context assembly. It ranks code chunks based on multiple signals including BM25 search results, symbol matches, path relevance, and editor state.

**Exports**
* pathPrior(path: string): function: Returns a multiplier based on the file path to penalize non-edit targets.
* Candidate: interface: Represents a ranked chunk with its score and reasons.
* chunkRelevance(c: Chunk, q: Set<string>): function: Calculates a chunk's relevance score based on query token matches.
* rankedChunks(index: CodeIndex, path: string, q: Set<string>): function: Returns a sorted list of chunks for a specific path.
* chunkAt(index: CodeIndex, path: string, line: number): function: Retrieves a chunk at a specific line and path.
* identifiers(query: string): function: Extracts quoted strings and camelCase/snake_case words from a query.
* rankCandidates(index: CodeIndex, s: ContextSignals): function: Performs multi-signal fusion to return a sorted list of candidates.

**Collaborators**
* Imports:
    * `./codeIndex`: Provides `CodeIndex` type for index operations.
    * `./tokenize`: Provides `tokenize` function to split text into tokens.
    * `./types`: Provides `Chunk` and `ContextSignals` types.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `pathPrior` returns 0.3 for changelogs/history, 0.5 for devcontainer/github/circleci/tests/static/examples/configs, and 1 for others.
* `chunkRelevance` weights symbol-name matches as 2 and body matches as 1.
* `rankedChunks` sorts by relevance score descending, then by index ascending.
* `pathMatches` ignores tokens appearing in more than 10% of paths (unless the repo has fewer than 50 files).
* `pathMatches` returns the top 20 path matches.
* `Fusion.addList` applies the RRF formula: `weight / (RRF_K + i + 1)` where `RRF_K` is 60.
* `Fusion.sorted` applies `pathPrior` as a final multiplier to the RRF score.
* `rankCandidates` applies weights of 1.0 for BM25 and symbols, 0.6 for path matches, 0.5 for editor files, and 0.4 for neighbors.
* `rankCandidates` limits neighbors to the first 15 results.

**Notes**
* `identifiers` uses a regex to filter words that contain an underscore or a camelCase transition.
* `pathMatches` uses a logarithmic scoring system: `Math.log(1 + n / df.get(t)!)`.
* `bestChunk` is a private helper that returns the first element of `rankedChunks`.
* `Fusion` is a private class used to aggregate scores from different ranking sources.
