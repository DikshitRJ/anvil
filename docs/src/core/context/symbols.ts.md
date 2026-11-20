# `src/core/context/symbols.ts`

**Purpose**
Regex-based symbol extraction (functions, classes, methods, modules, headings) chosen by file extension.

**Exports**
- `SymbolInfo` (type, from `./types`): `name`, `kind`, `path`, `line`, `endLine`, optional `container`, `signature`.
- `extractSymbols(path, content)`: returns `SymbolInfo[]`.

**Collaborators**
- Imports: `./symbolsBrace` (`extractBrace`, `isBraceLanguage`), `./types`.
- Used by: `codeIndex.ts`.

**Key behaviour and invariants**
- Extension dispatch: `.py` Python, `.rb` Ruby, `.md` Markdown, `.rst` reStructuredText, brace languages via `symbolsBrace`; anything else returns `[]`. A trailing empty line is dropped first.
- Python (indentation based): `def`/`async def`/`class`. Top-level `def` is `function`, a def inside a class is `method`. Functions nested in a function are skipped. A symbol starts at its first decorator line; the signature spans up to 5 lines until one ends with `:`; the body ends at the last line indented deeper, ignoring blank and comment lines.
- Ruby: `def`, `class`, `module` with indentation ends, including the closing `end`.
- Markdown: ATX headings, ignoring those inside code fences; a heading ends before the next heading of the same or higher level. RST: a text line followed by an underline of at least its length; level follows the order the underline characters first appear.
- Every symbol is capped so `endLine` is between `line` and `line + 399` (`MAX_LEN` 400).

**Notes**
- Heuristic parsing, not a real parser; unusual formatting can be missed.
