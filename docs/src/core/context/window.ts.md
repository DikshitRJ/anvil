# `src/core/context/window.ts`

**Purpose**
Trims an oversized chunk to a window of lines around the lines that best match the query.

**Exports**
- `windowChunk(chunk, queryTokens, maxTokens)`: returns the chunk unchanged or a trimmed copy.

**Collaborators**
- Imports: `./tokenize`, `./types`.
- Used by: `assemble.ts` (cap is 12% of the budget).

**Key behaviour and invariants**
- `maxChars = maxTokens * 4`; a chunk at or under that size is returned as is.
- Otherwise the centre is the line with the most query-token hits (the first such line on ties, line 0 if none hit), and the window grows alternately upward and downward while it fits.
- `startLine` and `endLine` are shifted to the window; other fields (id, path, symbol) are kept. Text is finally cut to `maxChars`.

**Notes**
- If even the centre line exceeds the limit, only its first `maxChars` characters are kept.

- Line windows charge only separating newlines, so an adjacent line that exactly fits is retained.
