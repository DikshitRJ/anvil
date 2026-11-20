# `src/core/context/mentions.ts`

**Purpose**
Parses `@file` and `@symbol` mentions typed in the panel prompt.

**Exports**
- `Mention` (type, from `./types`): `kind` (`file` or `symbol`), `value`, `raw`.
- `parseMentions(text, knownFiles)`: returns `{ mentions, cleaned }`.

**Collaborators**
- Imports: `./types`.
- Used by: the run controller (feeds `ContextSignals.mentions`).

**Key behaviour and invariants**
- A mention is `@token` at the start of the text or after whitespace or `(`. Trailing `. , ; : ) ! ?` is stripped from the token before resolving.
- Resolution order: exact known file; a unique known file whose path ends with `/token`; `#name` is a symbol; a plain identifier (letters, digits, `_`, `.`) is a symbol. If several files match, the file is not resolved and it falls through to the symbol rules.
- Unresolvable mentions are left untouched in the text.
- In `cleaned`, the `@` (and a leading `#`) is removed, so the prompt reads naturally; `raw` keeps the original `@token`.

**Notes**
- Symbol mentions are not checked against the index here.
