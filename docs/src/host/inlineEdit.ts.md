# `src/host/inlineEdit.ts`

**Purpose**
The `anvil.inlineEdit` command: streams a model rewrite of the selection into a live whole-file diff, then lets the user accept or reject it per hunk.

**Exports**
- `InlineEditDeps`: `review`, `getIndex()`, `createSession()`, `applyAccepted(path, before, after, summary)`, `log`.
- `cancelActiveInlineEdit()`: cancels the running inline edit; returns `true` if one was active (used by `anvil.cancel`).
- `registerInlineEdit(context, deps)`: registers the command; unexpected failures are logged.

**Collaborators**
- Imports: `vscode`, `core/inline/prompt`, `CodeIndex` (type), `trueforge/session` (type), `./reviewController`, `./reviewModel` (`relativeInside`).
- Used by: `extension.ts`.

**Key behaviour and invariants**
- Only `file:` documents inside the workspace folder are handled; otherwise a warning is shown. Only one inline edit runs at a time (`activeCancel` slot, also claimed while the instruction input box is open); a second invocation warns "press Esc to cancel it".
- Target range: the selection extended to whole lines (a selection ending at column 0 drops that last line). An empty selection expands to the smallest enclosing indexed symbol at the cursor (not `module`), else just the cursor line.
- Context: for identifiers in the selection, the first definition elsewhere (not the selected code) is added as 6 lines starting at its declaration, up to 8000 characters (about 2000 tokens).
- The session is created before the review opens (this throws if no models are configured; reported with an "Open Doctor" option). The review is `openLive`; streamed text is stitched into `before + matchIndentation(replacement) + after` and updates the live diff. The inline agent has no tools: any approval is denied ("Inline edit has no tools."). Model switches show a warning toast and retries are logged.
- Cancel (Esc, progress cancel button, or `anvil.cancel`) cancels the live review and the session; the status bar shows "inline edit cancelled". Errors cancel the review and show an error toast without awaiting it (so the slot is freed); no toast if the user cancelled.
- On completion the user finishes the review (`live.finish`). If rejected (`content === null`) nothing happens. If the document version changed during generation, the edit is not applied and a warning is shown. Otherwise `applyAccepted` records it as a checkpointed standalone change and "applied N of M hunks" is shown.
- `anvil.running` is set while a job runs and cleared in `finally`, where the session is disposed.

**Notes**
- The edit is applied from the original text captured at start, never from live editor state.
