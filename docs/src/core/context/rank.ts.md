# `src/core/context/rank.ts`

**Purpose**
This file implements candidate generation and weighted Reciprocal Rank Fusion (RRF) for context assembly. It ranks code chunks based on query relevance, symbol matches, path similarity, and editor state.

**Exports**
* pathPrior(path: string): function: Returns a multiplier based on the file path to penalize non-edit targets.
* Candidate: interface: Represents a ranked chunk with a score and reasons.
* chunkRelevance(c: Chunk, q: Set<string>): function: Calculates a chunk's relevance score based on query token matches.
* rankedChunks(index: CodeIndex, path: string, q: Set<string>): function: Returns a sorted list of chunks for a specific path.
* chunkAt(index: CodeIndex, path: string, line: number): function: Finds a chunk containing a specific line number.
* identifiers(query: string): function: Extracts quoted strings and camelCase/snake_case words from a query.
* rankCandidates(index: CodeIndex, s: ContextSignals): function: Executes the full fusion pipeline to return a sorted list of candidates.

**Collaborators**
* Imports: 
    * `./codeIndex`: Provides `CodeIndex` type for index operations.
    * `./tokenize`: Provides `tokenize` function to process text into tokens.
    * `./types`: Provides `Chunk` and `ContextSignals` types.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `RRF_K` is set to 60 for the Reciprocal Rank Fusion calculation.
* `pathPrior` returns 0.3 for changelog/history files, 0.5 for devcontainer/github/circleci/tests/static paths, and 1 for others.
* `chunkRelevance` counts body matches as 1 and symbol matches as 2.
* `identifiers` filters words to only include those containing an underscore or a camelCase transition.
* `pathMatches` limits the result to the top 20 paths.
* `rankCandidates` applies weights of 1.0 for BM25 and symbol matches, 0.6 for path matches, 0.5 for editor files, and 0.4 for neighbors.
* `rankCandidates` limits neighbors to the top 15 paths.
* `Fusion.sorted` applies `pathPrior` as a final multiplier to the RRF score.

**Notes**
* `chunkRelevance` uses a `Set` for the body and symbol tokens to ensure distinct matches.
* `identifiers` uses a regex to ensure words start with an uppercase letter or underscore.
* `pathMatches` uses a term frequency (df) calculation to score paths.
* `Fusion.sorted` uses `chunk.id` as a tie-breaker for sorting.
