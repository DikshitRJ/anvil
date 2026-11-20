# `src/core/context/window.ts`

**Purpose**
This file provides functionality to trim oversized text chunks into a smaller window of lines. It centers the window on the lines with the most query-matched tokens while staying within a character limit.

**Exports**
* windowChunk(c: Chunk, q: Set<string>, maxTokens: number): Chunk: A function that returns a truncated Chunk based on query hits and a maximum token limit.

**Collaborators**
* Imports: 
    * `./tokenize`: Used to tokenize lines for hit counting.
    * `./types`: Provides the Chunk type definition.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `maxChars` is calculated as `maxTokens * 4`.
* `windowChunk` returns the original Chunk if `c.text.length` is less than or equal to `maxChars`.
* `lineHits` maps each line to the count of tokens present in the query set `q`.
* `bestCenter` identifies the index of the line with the highest hit count.
* `grow` expands the window boundaries `lo` and `hi` by alternating directions (up then down) until a line exceeds `maxChars` or the boundary is undefined.
* `windowChunk` updates `startLine` and `endLine` by adding the relative `lo` and `hi` offsets to the original `c.startLine`.
* The final text is joined by `\n` and sliced to a maximum of `maxChars`.

**Notes**
* `bestCenter` defaults to index 0 if no hits are found or if the first hit is the highest.
* `grow` uses a `stuck` counter to limit consecutive failures to move in one direction.
* `used` length calculation includes a `+ 1` for the newline character.
