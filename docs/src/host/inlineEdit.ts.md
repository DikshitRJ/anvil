# `src/host/inlineEdit.ts`

**Purpose**
This file implements the `anvil.inlineEdit` command. It streams a rewrite of a selected code block into a live whole-file diff for per-hunk review.

**Exports**
* `cancelActiveInlineEdit()`: function: Returns true if an active inline edit was cancelled, otherwise false.
* `registerInlineEdit(context: vscode.ExtensionContext, deps: InlineEditDeps)`: function: Registers the `anvil.inlineEdit` command and manages its lifecycle.

**Collaborators**
* Imports:
    * `vscode`: Provides editor, window, and command APIs.
    * `../core/inline/prompt`: Provides `buildInlinePrompt`, `extractPartialReplacement`, `extractReplacement`, and `matchIndentation`.
    * `../core/context/codeIndex`: Provides the `CodeIndex` type.
    * `../trueforge/session`: Provides the `AnvilSession` type.
    * `./reviewController`: Provides `LiveReview` and `ReviewController` types.
    * `./reviewModel`: Provides the `relativeInside` function.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `CONTEXT_CHAR_BUDGET` limits the context to 8000 characters (approximately 2000 tokens).
* `lineSelection` expands an empty selection to the symbol boundaries if a symbol is found at the cursor.
* `lineSelection` reduces the end line by 1 if the selection ends at character 0 and spans multiple lines.
* `buildContext` includes up to 5 lines of code for each symbol found in the selection.
* `runJob` sets the `anvil.running` context to true during execution and false in the `finally` block.
* `finishEdit` prevents applying the edit if the document version has changed since the job started.
* `askInstruction` sets `activeCancel` to a no-op function while the input box is open to claim the execution slot.
* `inlineEdit` only executes if the active editor is a file scheme.

**Notes**
* `reportError` provides an option to run `anvil.doctor` when an error occurs.
* `runJob` catches session creation errors and reports them via `reportError`.
* `finishEdit` ignores the result if `r.content` is null.
* `runJob` suppresses the toast notification on cancellation to avoid holding the inline-edit slot.
