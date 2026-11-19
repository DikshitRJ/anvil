# `src/core/context/rank.ts`

**Purpose**
This file ranks code chunks to assemble context for a query. It uses Reciprocal Rank Fusion to combine results from multiple search methods.

**Exports**
* Candidate(chunk: Chunk, score: number, reasons: string[]): Candidate - interface - Defines a ranked code chunk with its score and reasons.
* chunkRelevance(c: Chunk, q: Set<string>): number - function - Calculates a score based on token matches in a chunk.
* rankedChunks(index: CodeIndex, path: string, q: Set<string>): Chunk[] - function - Returns chunks from a path sorted by relevance.
* chunkAt(index: CodeIndex, path: string, line: number): Chunk | undefined - function - Returns the chunk containing a specific line number.
* identifiers(query: string): string[] - function - Extracts quoted strings and valid variable names from a query.
* rankCandidates(index: CodeIndex, s: ContextSignals): Candidate[] - function - Executes the fusion logic to return a sorted list of candidates.

**Collaborators**
* Imports: `./codeIndex`, `./tokenize`, `./types`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* Symbol matches count double in relevance scores.
* Reciprocal Rank Fusion uses a constant K value of 60.
* Path matches use a weight of 0.6.
* Editor files use a weight of 0.5.
* Neighbor files use a weight of 0.4.
* The fusion logic limits path matches to the top 20 results.
* The fusion logic limits neighbors to the first 15 results.
* Results are sorted by score descending, then by chunk ID ascending.
