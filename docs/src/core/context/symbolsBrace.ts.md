# `src/core/context/symbolsBrace.ts`

**Purpose**
Regex symbol extraction for brace languages: TS/JS, Go, Java/Kotlin/C#, Rust, C/C++.

**Exports**
- `isBraceLanguage(ext)`: whether the extension is supported (`.ts .tsx .js .jsx .mjs .cjs .java .kt .cs .c .h .cpp .hpp .cc .go .rs`).
- `braceEnd(lines, start)`: 0-based end index of the block starting at a line.
- `extractBrace(path, ext, lines)`: `SymbolInfo[]` sorted by line.

**Collaborators**
- Imports: `./types`.
- Used by: `symbols.ts`.

**Key behaviour and invariants**
- Per-language specs list declaration regexes (class, interface, type/enum, function, arrow-function consts, Go receiver methods with the receiver type as `container`, Rust `impl`/`trait`, C functions) plus an indented-method regex for container bodies.
- `braceEnd` counts `{`/`}` from the declaration line, scanning at most 400 lines. If no `{` has been seen it ends at a line ending with `;` or after 5 lines (declarations without bodies). It does not understand braces in strings or comments.
- Names in `NOT_METHOD` (`if for while switch catch return new else throw function`) are never symbols; the C regex also excludes control keywords.
- For container kinds (`holds`), members are the lines matching the method regex that share the indentation of the first match; after extracting them the container body is skipped, so nested declarations are not extracted separately.

**Notes**
- Methods get `container` = the enclosing class/impl/trait name.
