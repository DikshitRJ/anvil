# `src/core/context/assemble.ts`

**Purpose**
This file assembles a context pack for a language model. It selects and ranks code chunks based on a token budget and user signals.

**Exports**
* ContextItem(params): ContextItem - type - Represents a single piece of context with metadata.
* ContextPack(params): ContextPack - type - Represents the final collection of context items and budget status.
* ContextSignals(params): ContextSignals - type - Represents user inputs like selections and mentions.
* estimateTokens(text: string): number - function - Calculates the estimated token count of a string.
* assembleContext(index: CodeIndex, s: ContextSignals, budget: number): ContextPack - function - Builds a context pack by combining pins, ranked chunks, and a repository map.
* renderContextPack(p: ContextPack): string - function - Converts a context pack into a formatted string for the user message.

**Collaborators**
* Imports: `./codeIndex`, `./rank`, `./tokenize`, `./types`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function `estimateTokens` uses a fixed divisor of 4.
* The `assembleContext` function prioritizes "pinned" items (selections and mentions) before adding ranked chunks.
* The `MAX_PER_FILE` constant limits the number of context items from a single file to 3.
* The `overlaps` function prevents adding context items that occupy the same line range in the same file.
* The `renderContextPack` function escapes special characters like `&`, `"`, and `<`.
* The `repoMap` item occupies a maximum of 10% of the total budget.
* The `PIN_SHARE` constant allocates 50% of the budget to pinned items.
* The `WHOLE_FILE_SHARE` constant allocates 35% of the budget to whole file mentions.

**Notes**
* If a symbol mention exists but the specific chunk is missing, the code falls back to a 5-line window around the symbol.
* If a file mention exceeds the whole file budget, the code selects the top 3 ranked chunks instead.
