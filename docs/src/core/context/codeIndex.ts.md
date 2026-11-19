# `src/core/context/codeIndex.ts`

**Purpose**
This file manages an in-memory index of a codebase. It stores file contents, symbols, chunks, and import relationships to support searching and repository mapping.

**Exports**
* CodeIndex(root: string): CodeIndex - class - Manages the codebase index and provides search and navigation methods.

**Collaborators**
* Imports: `node:fs`, `node:path`, `picomatch`, `./assemble`, `./bm25`, `./chunker`, `./imports`, `./symbols`, `./tokenize`, `./walker`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* Skips binary files by checking for NUL bytes in the first 8 KB.
* Limits search results to a maximum of 3 hits per file.
* Uses a concurrency limit of 32 workers during index building.
* Resets the import graph to undefined when a file is updated or removed.
* Sorts file lists alphabetically.
* Sorts search results by score, then by chunk ID.
* Limits symbol search results to 20 items.
* Limits grep results to a default of 100 matches.

**Notes**
* The `repoMap` method uses a token estimation to truncate the output if it exceeds the `maxTokens` limit.
* The `search` method applies specific score multipliers for path token matches (1.25x) and symbol matches (1.4x).
