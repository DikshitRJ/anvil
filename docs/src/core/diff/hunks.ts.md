# `src/core/diff/hunks.ts`

**Purpose**
This file computes line-based diff hunks between an original and a proposed string. It provides utilities to apply a subset of these hunks to the original text, preview changes, and generate unified-diff style summaries for agent feedback.

**Exports**
* Hunk (interface): Defines the structure of a change hunk including indices, lines, and EOF metadata.
* HunkDecision (type): Defines the possible states for a hunk: 'pending', 'accepted', or 'rejected'.
* splitLines(text: string) (function): Parses a string into lines, identifying the dominant EOL style and trailing newline status.
* computeHunks(original: string, proposed: string) (function): Generates an array of Hunk objects representing the differences between two strings.
* applyHunks(original: string, hunks: Hunk[], accepted: ReadonlySet<number>) (function): Reconstructs a string by applying only the accepted hunks to the original text.
* previewContent(original: string, hunks: Hunk[], decisions: ReadonlyMap<number, HunkDecision>) (function): Returns a string representing the content with pending and accepted hunks applied.
* summarizeHunk(h: Hunk, maxLines?: number) (function): Produces a unified-diff style string representation of a single hunk.

**Collaborators**
* Imports: diff (diffArrays) is used to identify added, removed, and unchanged line segments.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* Hunks contain only changed lines and do not include context lines.
* `origStart` and `newStart` are 0-based line indices.
* `splitLines` determines the dominant EOL as CRLF if CRLF terminators are at least as common as bare LF.
* `computeHunks` surfaces a specific `eofOnly` hunk if the trailing newline or dominant EOL changes but the content remains the same.
* `applyHunks` rewrites every terminator in the file to the new dominant EOL if an accepted hunk contains an `eof` change.
* `summarizeHunk` defaults to a `maxLines` limit of 12 for clipping.
* `summarizeHunk` calculates the header using 1-based line numbers (index + 1).

**Notes**
* `splitLines` handles the edge case of a last line without a trailing newline by assigning an empty string to its terminator.
* `applyHunks` returns an empty string if the resulting output array is empty.
* `previewContent` treats both 'pending' and 'accepted' decisions as included in the preview.
