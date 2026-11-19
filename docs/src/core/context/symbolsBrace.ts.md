# `src/core/context/symbolsBrace.ts`

**Purpose**
This file extracts symbols from source code files that use curly braces for block scoping. It identifies classes, interfaces, functions, and methods across multiple programming languages.

**Exports**
* isBraceLanguage(ext: string): boolean - function - Checks if a file extension belongs to a supported brace-based language.
* braceEnd(lines: string[], start: number): number - function - Calculates the end index of a code block starting from a specific line.
* extractBrace(path: string, ext: string, lines: string[]): SymbolInfo[] - function - Parses a file to find and return all symbols and their nested members.

**Collaborators**
* Imports: `./types`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The `braceEnd` function limits its search to 400 lines from the start index.
* The `braceEnd` function returns the current index if no opening brace is found and the line ends with a semicolon.
* The `members` function only includes methods that match the specific indentation of the first detected member.
* The `extractBrace` function skips the body of a container after extracting its members.
* Symbols are returned in ascending order of their line numbers.
* The `NOT_METHOD` set prevents keywords like `if`, `for`, and `while` from being identified as symbols.

**Notes**
* The `GO` specification handles receiver types for methods.
* The `C` specification uses a negative lookahead to exclude common keywords from function identification.
