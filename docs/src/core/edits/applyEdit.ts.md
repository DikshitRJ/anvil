# `src/core/edits/applyEdit.ts`

**Purpose**
This file simulates edit operations on file text. It provides logic to replace text or write new content without modifying the actual file.

**Exports**
* EditOp(type): type - Defines the structure for write and replace operations.
* EditErrorCode(type): type - Defines the set of possible error codes for edit operations.
* EditError(class): class - Represents an error that occurs during an edit simulation.
* simulateEdit(current: string | null, op: EditOp): string - Executes a simulated edit and returns the new text.

**Collaborators**
* Imports: Not visible from this file.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The function tries an exact string match before trying a fuzzy line match.
* Fuzzy matches ignore leading and trailing whitespace on lines.
* Fuzzy matches require a unique match; multiple matches cause an AMBIGUOUS error.
* The function throws an error if the edit results in no change to the text.
* The function throws an error if the file content is null.
* The function throws an error if the old string in a replace operation is empty.
* The function preserves the original line endings of the source text.
* The function adjusts indentation for fuzzy replacements based on the original match.

**Notes**
* Fuzzy matching strips blank lines from the start and end of the provided strings.
