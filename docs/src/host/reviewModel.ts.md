# `src/host/reviewModel.ts`

**Purpose**
vscode-free state of one review: per-hunk decisions, the resulting content and feedback text, and the mapping between hunks and preview lines.

**Exports**
- `ReviewOutcome`: `content` (string or null), `accepted`, `total`, `feedback`.
- `HunkAnchor`: `hunkId`, `line` (0-based first line in the preview), `span` (preview lines occupied).
- `ReviewModel(original, proposed)`: `hunks`, `total`, `decisionOf`, `decidedCount`, `acceptedCount`, `allDecided`, `decide`, `decideAll`, `preview`, `outcome`, `feedback`, `anchors`, `hunkAtLine`.
- `relativeInside(root, file)`.

**Collaborators**
- Imports: `../core/diff/hunks` (`applyHunks`, `computeHunks`, `previewContent`, `summarizeHunk`, types).
- Used by: `reviewController.ts`, `inlineEdit.ts` (`relativeInside`).

**Key behaviour and invariants**
- All hunks start `pending`. `decide` returns `false` for an unknown hunk id; `decideAll` sets every hunk.
- `outcome().content`: with zero hunks, `null` if the texts are identical, otherwise the proposed text as is (covers changes a line diff cannot show, such as creating an empty file); with hunks, `null` if none accepted, else `applyHunks` over the accepted set.
- `feedback`: "No visible changes." for zero hunks; "Accepted all N hunk(s)."; otherwise a header ("The user rejected all N hunk(s):" or "Accepted A of N hunks. The user rejected:") followed by a unified-diff summary of each rejected hunk (each side clipped to 8 lines). The whole text is capped at 40 lines with a "... (N more lines)" marker.
- `anchors` position each hunk in `preview()`: a rejected hunk occupies its original line count, others their new line count; offsets accumulate, so a deletion or rejected insertion has span 0.
- `hunkAtLine` returns the hunk containing the line, else the nearest one by line distance.
- `relativeInside` normalises backslashes and trailing slashes and returns the POSIX relative path, or `undefined` when the file is not strictly inside the root (including the root itself).

**Notes**
- The feedback text is what the agent reads after a partial or total rejection.
