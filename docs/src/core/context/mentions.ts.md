# `src/core/context/mentions.ts`

**Purpose**
This file parses mentions of files and symbols from text. It identifies these mentions and returns a cleaned version of the text.

**Exports**
* Mention(params): type - This type defines the structure of a mention object.
* parseMentions(text: string, knownFiles: ReadonlySet<string>): { mentions: Mention[]; cleaned: string } - function - This function extracts mentions from a string and returns the list of mentions and the cleaned text.

**Collaborators**
* Imports: ./types
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function identifies file mentions if the token matches a known file or a unique file path ending in the token.
* The function identifies symbol mentions if the token starts with # or matches a valid identifier pattern.
* The function removes punctuation from the end of a token before resolution.
* The function returns the original text if a token does not match a file or a symbol.
* The function replaces the mention in the text with the symbol name or file name without the @ prefix.

**Notes**
* If multiple files match a token, the function does not resolve the mention.
