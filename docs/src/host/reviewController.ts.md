# `src/host/reviewController.ts`

**Purpose**
This file manages the user interface for reviewing code changes. It handles the display of diffs, manages review sessions, and processes user decisions on specific code hunks.

**Exports**
* ReviewRequest(path, original, proposed, title, source): ReviewRequest - type - Defines the data required to start a review.
* ReviewResult(content, accepted, total, feedback): ReviewResult - type - Defines the final outcome of a review.
* ReviewCancelledError(reason): ReviewCancelledError - class - Represents an error when a user cancels a review.
* LiveReview(update, finish, cancel): LiveReview - interface - Defines methods for interacting with a streaming review session.
* ReviewController(_context): ReviewController - class - Manages the lifecycle, queue, and UI elements of review sessions.

**Collaborators**
* Imports: `vscode`, `../core/diff/hunks`, `./reviewModel`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The controller never writes data to the disk.
* It uses a queue to manage multiple review sessions.
* It throttles UI updates to a maximum of one every 100 milliseconds.
* It automatically rejects pending hunks if a user closes the diff tab manually.
* It uses CodeLens to display "Accept" and "Reject" actions for each hunk.
* It applies visual decorations to accepted and rejected lines in the editor.

**Notes**
* The `LiveReview` interface allows the UI to update the proposed content while the agent is still streaming text.
* The `target` method identifies the correct session and hunk based on either explicit command arguments or the current cursor position.
