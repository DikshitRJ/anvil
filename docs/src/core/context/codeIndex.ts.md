# `src/core/context/codeIndex.ts`

**Purpose**
Provides an in-memory index of a codebase including file contents, symbols, chunks, and an import graph. It enables efficient searching, symbol lookups, and repository mapping.

**Exports**
* CodeIndex(root: string): class: Represents the primary index structure and provides methods for indexing and querying the codebase.

**Collaborators**
* Imports:
    * `node:fs`: Used to read file contents from the filesystem.
    * `node:path`: Used to handle and join file paths.
    * `picomatch`: Used to filter files based on glob patterns.
    * `./assemble`: Used to estimate token counts for repository mapping.
    * `./bm25`: Used to manage the BM25 search index.
    * `./chunker`: Used to split file contents into searchable chunks.
    * `./imports`: Used to extract and resolve import specifications.
    * `./symbols`: Used to extract symbol information from content.
    * `./tokenize`: Used to convert strings into tokens for indexing and searching.
    * `./types`: Provides type definitions for Chunk, SearchHit, and SymbolInfo.
    * `./walker`: Used to recursively walk the workspace directory.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `CONCURRENCY` is set to 32 for parallel file processing.
* `MAX_PER_FILE` is set to 3, limiting the number of search hits returned per file.
* `GREP_MAX_LINES` is set to 200,000 and `GREP_MAX_MS` is set to 200 for grep execution limits.
* `safeRegExp` falls back to a literal search if a pattern contains a `NESTED_QUANTIFIER`.
* `build` skips files containing a `NUL` byte in the first 8192 bytes.
* `search` applies a 1.25 score multiplier if a query token exists in the file's path tokens.
* `search` applies a 1.4 score multiplier if the last segment of a chunk's symbol matches an identifier in the query.
* `findSymbol` returns up to 20 results based on a multi-stage matching process.
* `repoMap` defaults to a `maxTokens` limit of 1500.
* `dirLines` limits the directory tree depth to the top 2 levels.

**Notes**
* `grep` sets `grepTruncated` to true if the scan budget is exceeded.
* `updateFile` clears the existing index for a file before re-indexing.
* `importGraph` is lazily initialized and cached in the `graph` property.
* `removeFile` deletes entries from all internal maps and the BM25 index.
