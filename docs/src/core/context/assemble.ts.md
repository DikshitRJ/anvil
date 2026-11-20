# `src/core/context/assemble.ts`

**Purpose**
This file assembles a budgeted context pack by combining pinned items, ranked chunks, and a repository map. It manages token budgets and ensures that selected context items do not overlap or exceed specified limits.

**Exports**
* ContextItem (type): Represents a single unit of context including path, lines, kind, and reason.
* ContextPack (type): Represents the final assembled context package with items, budget, and dropped items.
* ContextSignals (type): Represents the input signals including query, mentions, and selection.
* estimateTokens (function): Calculates the estimated token count of a string by dividing length by 4.
* assembleContext (function): Orchestrates the collection of pins, repository map, and ranked chunks into a ContextPack.
* renderContextPack (function): Converts a ContextPack into a formatted string using `<anvil_context>` tags.

**Collaborators**
* Imports:
    * `./codeIndex`: Provides `CodeIndex` type for index operations.
    * `./rank`: Provides `chunkAt`, `rankCandidates`, `rankedChunks`, and `Candidate` type for ranking.
    * `./tokenize`: Provides `tokenize` for query processing.
    * `./window`: Provides `windowChunk` for context windowing.
    * `./types`: Provides `Chunk`, `ContextItem`, `ContextPack`, and `ContextSignals` types.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `PIN_SHARE` is set to 0.5 for calculating the pin budget.
* `WHOLE_FILE_SHARE` is set to 0.35 for determining if a whole file fits in the budget.
* `REPO_MAP_SHARE` is set to 0.1 for the repository map budget.
* `MAX_PER_FILE` limits the number of context items from a single file to 3.
* `CHUNK_CAP_SHARE` is set to 0.12 for the chunk capacity limit.
* `estimateTokens` uses `Math.ceil(text.length / 4)`.
* `collectPins` ensures that pinned items do not overlap in their line ranges.
* `fileMention` selects a whole file if it fits the budget, otherwise it takes the top 3 ranked chunks.
* `symbolMention` attempts to find a chunk at a symbol's location, falling back to a 5-line context if the chunk is missing.
* `selectionItem` truncates selection text if it exceeds the calculated capacity.
* `assembleContext` calculates `room` by subtracting pinned tokens and repository map tokens from the total budget.
* `packRanked` skips candidates that overlap with existing pins or exceed the `MAX_PER_FILE` limit.
* `neutralise` escapes closing tags by replacing `</` with `<\/`.
* `attr` escapes `&`, `"`, and `<` characters for HTML-safe attributes.

**Notes**
* `fileMention` returns an empty array if the file content is undefined.
* `symbolMention` returns an empty array if the symbol is not found in the index.
* `repoMapItem` returns `undefined` if no text is produced or if the text is empty.
* `assembleContext` takes the first 5 unique paths from pins and candidates to focus the repository map.
* `renderContextPack` includes a hardcoded note in the header: "Files pre-selected by Anvil; each item says why."
