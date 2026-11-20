# `src/core/context/tokenize.ts`

**Purpose**
Identifier-aware tokenizer shared by indexing and query parsing.

**Exports**
- `tokenize(text)`: returns the list of lowercase, lightly stemmed tokens.

**Collaborators**
- Imports: none.
- Used by: `codeIndex.ts`, `rank.ts`, `assemble.ts`, `window.ts`.

**Key behaviour and invariants**
- Text is split on anything outside `[A-Za-z0-9_]`.
- A camelCase or snake_case word yields the whole word plus its parts (so `parseMentions` gives `parsementions`, `parse`, `mentions`).
- Leading/trailing underscores are trimmed; tokens are lowercased.
- Dropped: single characters, all-digit tokens, and stop words (e.g. `def self return import from if the const let var function true false null`).
- Stemming: a token longer than 4 characters ending in `s` (but not `ss`) loses the `s`.

**Notes**
- The same function must be used for documents and queries, otherwise matching breaks.
