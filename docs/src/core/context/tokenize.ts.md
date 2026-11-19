# `src/core/context/tokenize.ts`

**Purpose**
This file converts a string of text into an array of tokens. It identifies meaningful words for use in indexing and querying.

**Exports**
* tokenize(text: string): string[] - function: It processes a string into a list of cleaned and stemmed tokens.

**Collaborators**
* Imports: Not visible from this file.
* Exports to: Not visible from this file.

**Key behaviour and invariants**
* The function converts all tokens to lowercase.
* The function removes leading and trailing underscores.
* The function removes words that are in the STOP set.
* The function removes tokens that consist only of digits.
* The function removes tokens with a length of 1.
* The function performs light stemming on words ending in 's'.
* The function splits camelCase and snake_case identifiers into separate tokens.

**Notes**
* The stem function does not modify words ending in 'ss'.
* The stem function only modifies words longer than 4 characters.
