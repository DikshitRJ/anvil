# `src/core/diff/hunks.ts`

**Purpose**
This file computes and manages line-based diff hunks between two strings. It allows the system to apply, preview, and summarize specific changes for an agent.

**Exports**
* Hunk(id, origStart, origLines, newStart, newLines, eof?): interface - Defines the structure of a change block.
* HunkDecision('pending' | 'accepted' | 'rejected'): type - Defines the status of a hunk.
* splitLines(text: string): { lines: string[], eol: Eol, trailingNewline: boolean } - function - Splits a string into lines and identifies line endings.
* computeHunks(original: string, proposed: string): Hunk[] - function - Identifies changed line blocks between two strings.
* applyHunks(original: string, hunks: Hunk[], accepted: ReadonlySet<number>): string - function - Constructs a new string by applying a set of accepted hunks.
* previewContent(original: string, hunks: Hunk[], decisions: ReadonlyMap<number, HunkDecision>): string - function - Returns a string with all non-rejected hunks applied.
* summarizeHunk(h: Hunk, maxLines = 12): string - function - Creates a unified-diff style summary of a single hunk.

**Collaborators**
* Imports: diff (diffArrays)
* Exports: Not visible from this file.

**Key behaviour and invariants**
* Hunks contain only changed lines and no context lines.
* `origStart` and `newStart` use 0-based line indices.
* `applyHunks` sorts hunks by `origStart` before processing.
* `summarizeHunk` clips long hunks to a default limit of 12 lines.
* `previewContent` treats both 'pending' and 'accepted' decisions as applied.
* `eof` properties only exist on the hunk that reaches the end of both files.

**Notes**
* If the original string is empty, `applyHunks` adopts the `eol` from the `eof` property of the final hunk.
