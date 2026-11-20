# `src/host/reviewController.ts`

**Purpose**
Per-hunk review UI: shows a native diff editor of original vs proposed text with CodeLens Accept/Reject per hunk. It never writes to disk.

**Exports**
- `ReviewRequest`: `path`, `original`, `proposed`, optional `title`, `source` (`agent` | `inline`).
- `ReviewResult`: `content` (final text, or `null` if nothing accepted), `accepted`, `total`, `feedback`.
- `ReviewCancelledError`.
- `LiveReview`: `update(proposed)`, `finish(finalProposed)`, `cancel()`.
- `ReviewController` (implements `vscode.Disposable`): `review(req)`, `openLive(req)`, `cancelAll(reason)`, `pendingCount`, `dispose()`.

**Collaborators**
- Imports: `vscode`, `../core/diff/hunks` (`HunkDecision`), `./reviewModel`.
- Used by: `approvalFlow.ts` (agent edits), `inlineEdit.ts` (live review), `runController.ts` (`cancelAll`), `extension.ts`.

**Key behaviour and invariants**
- Content comes from two virtual schemes, `anvil-original` and `anvil-proposed`, keyed by a `review=<id>` query. The proposed side shows `ReviewModel.preview()` (pending and accepted hunks applied; rejected hunks revert) once a model exists, else the streamed text.
- One diff is shown at a time; other sessions wait in a queue and the next opens when the current one is finalized or cancelled. `anvil.reviewing` is set while a review is current.
- `review()` with zero hunks resolves immediately from `ReviewModel.outcome()` (no UI). Otherwise it resolves when every hunk is decided: `content` is `null` if no hunk was accepted, else the original with only accepted hunks applied; `feedback` tells the agent what was rejected.
- `openLive` opens the diff right away; `update` repaints (throttled to 100 ms) and the lens reads "Anvil is writing...". `finish` builds the model from the final text and switches to decision mode (zero hunks completes at once; if the user closed the tab while streaming, the diff reopens). `finish` after cancel rejects with `ReviewCancelledError`.
- CodeLens: Accept all, Reject all, "N of M decided", and per hunk Accept / Reject (a deletion hunk shows what it deletes) or an "accepted/rejected - click to undo" lens. Commands `anvil.review.acceptHunk/rejectHunk/undoHunk/acceptAll/rejectAll` take `[reviewId, hunkId]` from the lens, or use the active proposed editor (hunk nearest the cursor) for keybindings. Accepted and rejected hunks are decorated.
- Closing the diff tab by hand: if all hunks are decided the review completes; otherwise it resolves with `content: null` and feedback "The user closed the review without deciding." (no partial commit).
- `cancelSession`/`cancelAll` reject the pending promise with `ReviewCancelledError`, close the tab and advance the queue; failure to open the diff also cancels. `dispose` cancels all.

**Notes**
- `pendingCount` counts open and queued sessions.
