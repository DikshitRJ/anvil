# `src/core/context/symbols.ts`

**Purpose**
This file extracts symbols from source code files. It identifies functions, classes, modules, and headings based on file extensions.

**Exports**
* SymbolInfo(params): SymbolInfo - type - Exports the SymbolInfo type definition.
* extractSymbols(path: string, content: string): SymbolInfo[] - function - Extracts symbols from a file based on its extension and content.

**Collaborators**
* Imports: ./symbolsBrace, ./types
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The maximum symbol length is 400 lines.
* Python symbols start at the first decorator line.
* Markdown headings end before the next heading of the same or higher level.
* RST headings require an underline character.
* The function ensures `endLine` does not exceed the `line` plus the maximum length.
* The function removes the last empty line from the content before processing.

**Notes**
* Python and Ruby use indentation to determine block ends.
* Markdown and RST use headings to determine block ends.
* Brace languages use a separate module for symbol extraction.
