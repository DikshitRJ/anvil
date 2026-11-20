# `src/core/diff/hunks.ts`

**Purpose**
Line-based diff hunks: compute change-only hunks between original and proposed text, apply or preview a subset, and summarise a hunk for agent feedback.

**Exports**
- `Hunk`: `id`, `origStart`/`newStart` (0-based line indices), `origLines`, `newLines`, optional `eof {trailingNewline, eol}` and `eofOnly`.
- `HunkDecision`: `pending | accepted | rejected`.
- `splitLines(text)`: `{lines, eol, trailingNewline, eols}`.
- `computeHunks(original, proposed)`, `applyHunks(original, hunks, acceptedIds)`, `previewContent(original, hunks, decisions)`, `summarizeHunk(h, maxLines = 12)`.

**Collaborators**
- Imports: `diff` (`diffArrays`).
- Used by: `host/reviewModel.ts`, `host/reviewController.ts`, `host/approvalFlow.ts`.

**Key behaviour and invariants**
- Hunks hold only changed lines (no context). Adjacent removed/added runs merge into one hunk; ids are sequential from 0.
- `splitLines` keeps each line's own terminator in `eols`; dominant EOL is CRLF when CRLF terminators are at least as common as LF (and at least one exists), else LF.
- Only the hunk that reaches the end of both files carries `eof` (the proposed trailing-newline and EOL style). If lines are identical but the trailing newline or dominant EOL differs, a synthetic hunk over the last line is added with `eofOnly: true`.
- `applyHunks` keeps untouched and rejected lines with their original terminators and inserts accepted lines with the dominant EOL. Accepting a hunk with `eof` also sets the trailing newline and EOL; if the EOL changes, every terminator is rewritten. Accepting all hunks reproduces the proposed text exactly. Empty output returns `''`.
- `previewContent` includes every hunk not `rejected` (so `pending` and `accepted` are both shown).
- `summarizeHunk` emits `@@ -a,n +c,m @@` followed by `-`/`+` lines, each side clipped to `maxLines` with a "... (N more lines)" marker. Start numbers are 1-based, except an empty side uses the 0-based index (unified-diff convention).

**Notes**
- This is the basis of per-hunk accept/reject in review; decisions refer to hunk ids, so they must be computed from the same original text.
