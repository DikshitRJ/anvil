# `src/host/reviewModel.ts`

**Purpose**
This file manages the state of a code review process. It tracks decisions for individual code hunks and generates preview content and final outcomes.

**Exports**
* ReviewOutcome(content: string | null, accepted: number, total: number, feedback: string): interface - It defines the structure of the final review result.
* HunkAnchor(hunkId: number, line: number, span: number): interface - It defines the position and size of a hunk in the preview text.
* ReviewModel(original: string, proposed: string): class - It manages hunk computations, user decisions, and generates review summaries.

**Collaborators**
* Imports: `../core/diff/hunks`
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The `MAX_FEEDBACK_LINES` constant limits feedback text to 40 lines.
* The `decide` method returns false if the hunk ID does not exist.
* The `outcome` method returns null content if zero hunks are accepted.
* The `anchors` method calculates line positions based on whether a hunk is accepted or rejected.
* The `hunkAtLine` method returns the ID of the nearest hunk to a specific line.

**Notes**
* The `capLines` function appends a summary of omitted lines if the feedback exceeds the line limit.
