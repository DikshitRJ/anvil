# `src/host/reviewController.ts`

**Purpose**
This file manages the per-hunk review UI for proposed code changes. It handles the lifecycle of review sessions, including streaming content, displaying diffs, and processing user decisions via CodeLens.

**Exports**
* ReviewRequest (interface): Defines the structure for a new review request including path, content, and source.
* ReviewResult (interface): Defines the structure for the final outcome of a review session.
* ReviewCancelledError (class): Represents an error thrown when a review session is explicitly cancelled.
* LiveReview (interface): Defines the interface for interacting with a streaming review session.
* ReviewController (class): Manages the state, queue, and UI interactions for multiple concurrent review sessions.

**Collaborators**
* Imports:
    * `vscode`: Provides the core VS Code API for text documents, diff editors, and CodeLens.
    * `../core/diff/hunks`: Provides the `HunkDecision` type for tracking hunk states.
    * `./reviewModel`: Provides the `ReviewModel` class for managing hunk logic and `ReviewOutcome` type.

**Exports used by**
Not visible from this file.

**Key behaviour and invariants**
* Maintains a `sessions` Map to track active reviews and a `queue` to manage sequential display of diffs.
* Uses `ORIGINAL` ('anvil-original') and `PROPOSED` ('anvil-proposed') schemes for virtual text documents.
* Throttles UI updates using `THROTTLE_MS` (100) to prevent excessive re-renders during streaming.
* Automatically advances to the next session in the queue when a current session is finalized or cancelled.
* Provides CodeLens actions for "Accept all", "Reject all", and individual hunk decisions.
* Applies `acceptedDeco` and `rejectedDeco` decorations to the `PROPOSED` editor to highlight user decisions.
* Cancels the session and returns a specific feedback message if the user closes the diff tab before all hunks are decided.

**Notes**
* Sessions are never written to disk.
* `openLive` allows for streaming content updates before the final `finish` call.
* The `target` method resolves which session and hunk to act upon based on either explicit command arguments or the current cursor position.
* `closeUndecided` handles the edge case where a user manually closes the diff editor tab.
