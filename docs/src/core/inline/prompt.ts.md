# `src/core/inline/prompt.ts`

**Purpose**
Builds the inline-edit prompt and parses the model's reply into replacement code.

**Exports**
- `InlineRequest`: `path`, `languageId`, `before`, `selection`, `after`, `instruction`, optional `context`.
- `buildInlinePrompt(request)`, `extractReplacement(text)`, `extractPartialReplacement(text)`, `matchIndentation(replacement, selection)`.

**Collaborators**
- Imports: none.
- Used by: `host/inlineEdit.ts`.

**Key behaviour and invariants**
- The prompt contains the file and language, the instruction, the last 60 lines before the selection, the selection (to rewrite), the first 30 lines after it, optional "Related definitions", and the demand for exactly one fenced block with the replacement for the selection only.
- `extractReplacement` returns the content of the last closed fenced block (backtick or tilde fences; a closing fence must use the same character and be at least as long). With no closed block it strips a lone opening fence (and trailing fence) from the trimmed text, or returns the trimmed text unchanged.
- `extractPartialReplacement` is for streaming: it returns the first fenced block's lines so far (open or closed), or the raw text if no fence has started.
- `matchIndentation` computes the selection's base indent from its first non-blank line; if the replacement's minimum indent is smaller, the missing whitespace is prepended to every non-blank line. Trailing newlines are removed, then one is added back only if the selection ended with a newline. An empty body returns `''`.

**Notes**
- Replacement indentation is never reduced, only added.
