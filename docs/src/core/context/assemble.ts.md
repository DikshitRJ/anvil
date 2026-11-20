# `src/core/context/assemble.ts`

**Purpose**
Builds the budgeted context pack for a run: pinned items first, then RRF-ranked chunks, then a repository outline.

**Exports**
- `estimateTokens(text)`: `ceil(length / 4)`.
- `assembleContext(index, signals, budget)`: returns a `ContextPack` (`items`, `budget`, `used`, `dropped`).
- `renderContextPack(pack)`: renders the `<anvil_context>` block placed in the user message.
- Re-exports the types `ContextItem`, `ContextPack`, `ContextSignals`.

**Collaborators**
- Imports: `CodeIndex` (type), `rank` (`rankCandidates`, `rankedChunks`, `chunkAt`), `tokenize`, `window`, `types`.
- Used by: `host/indexService.ts` / run controller; `codeIndex.ts` imports `estimateTokens` back from here.

**Key behaviour and invariants**
- Budget shares: pins up to 50%, a whole `@file` only if it costs at most 35% of the budget, repo map 10%, each ranked chunk windowed to 12%.
- Pins come from the editor selection, `@file` mentions (whole file if it fits, else its top 3 ranked chunks) and `@symbol` mentions (first symbol match, its chunk, else lines from 5 before the symbol to its end). A file mention is skipped if the file is not in the index.
- Pins that overlap an already pinned range are skipped; pins that exceed the pin cap are recorded in `dropped` ("over budget"). The selection text is truncated to the cap.
- The repo map is focused on the first 5 unique paths from pins and candidates, cut to its reserve, and omitted if empty.
- Ranked chunks fill `budget - pins - map`. A candidate is skipped if its file already has 3 items (pins included) or it overlaps one; if it does not fit it is added to `dropped`.
- Item order: pins, ranked chunks, repo map last. `used` is the sum of item tokens.
- Render: `neutralise` rewrites `</item` and `</anvil_context` in text to `<\/...` so content cannot close the wrapper; `attr` escapes `&`, `"`, `<` in attributes. The header carries `budget`, `used` and the note "Files pre-selected by Anvil; each item says why."

**Notes**
- Token counts are an estimate, not a tokenizer.
