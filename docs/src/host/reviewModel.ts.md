# `src/host/reviewModel.ts`

**Purpose**
This file manages the state of a code review session. It tracks hunk-level decisions, calculates review outcomes, and maps hunks to preview lines.

**Exports**
* ReviewOutcome: interface defines the structure of the final review result.
* HunkAnchor: interface defines the mapping between a hunk and its position in the preview text.
* ReviewModel: class manages the collection of hunks, user decisions, and provides methods to generate previews and outcomes.
* relativeInside(root: string, file: string): function returns a POSIX path if the file is inside the root directory.

**Collaborators**
* Imports:
    * `../core/diff/hunks`: provides `applyHunks`, `computeHunks`, `previewContent`, and `summarizeHunk` for diff processing.
    * `../core/diff/hunks`: provides types `Hunk` and `HunkDecision`.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `MAX_FEEDBACK_LINES` is set to 40.
* `capLines` truncates feedback text to 40 lines and appends a count of omitted lines.
* `ReviewModel` initializes `decisions` by setting all hunk IDs to `pending`.
* `decide` returns `false` if the hunk ID does not exist in the `decisions` map.
* `outcome` returns `null` content if `total` is 0 and `proposed` equals `original`.
* `outcome` returns `null` content if `accepted` count is 0 and `total` is greater than 0.
* `anchors` calculates line offsets by adjusting for the `span` of rejected hunks (reverting to `origLines.length`).
* `hunkAtLine` identifies the hunk ID with the minimum distance to a given line number.

**Notes**
* `relativeInside` normalizes paths by replacing backslashes with forward slashes and removing trailing slashes.
* `relativeInside` returns `undefined` if the file is not strictly inside the root or if the file path equals the root path.
* `feedback` uses a summary of 8 characters per rejected hunk.
