# `src/core/context/chunker.ts`

**Purpose**
This file splits source code files into smaller chunks for retrieval. It aligns these chunks with symbol boundaries like classes and methods.

**Exports**
* Chunk(path, startLine, endLine, text, symbol): type - This type represents a segment of a file.

**Collaborators**
* Imports: ./types
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function `chunkFile` returns an empty array if the file content is empty.
* The function `chunkFile` removes the last line if it is empty.
* The `MAX_CHUNK` limit is 150 lines.
* The `WINDOW` size is 120 lines.
* The `PLAIN_WINDOW` size is 60 lines.
* The `PLAIN_OVERLAP` is 10 lines.
* The `MIN_GAP_LINES` is 3 lines.
* The `BIG_CLASS` threshold is 120 lines.
* The `chunkFile` function uses a sliding window if no symbols exist.
* The `chunkFile` function uses symbol-based logic if symbols exist.
* The `bigClass` logic applies only to classes larger than 120 lines with methods.

**Notes**
* The `flatten` function sets the `endLine` of a heading to the line before the next symbol.
* The `topLevel` function identifies symbols that do not overlap with previous symbols.
