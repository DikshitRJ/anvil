# `src/host/inlineEdit.ts`

**Purpose**
This file implements the `anvil.inlineEdit` command. It streams a rewrite of a user's selection into a live whole-file diff and provides a per-hunk review process.

**Exports**
* `cancelActiveInlineEdit()` (function): Returns a boolean indicating if an active inline edit was successfully cancelled.
* `registerInlineEdit(context: vscode.ExtensionContext, deps: InlineEditDeps)` (function): Registers the `anvil.inlineEdit` command within the VS Code extension context.

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
* `CONTEXT_CHAR_BUDGET` limits the context size to 8000 characters (approximately 2000 tokens).
* `lineSelection` calculates a `vscode.Range` based on the current selection; if the selection is empty, it identifies the symbol at the cursor.
* `buildContext` gathers symbol bodies from the `CodeIndex` based on identifiers found in the selection, limited by `CONTEXT_CHAR_BUDGET`.
* `runJob` manages the lifecycle of an inline edit, including session creation, live review opening, and progress reporting.
* `finishEdit` verifies that the file version has not changed (`j.doc.version !== j.version`) before applying the accepted edit.
* `inlineEdit` prevents concurrent executions by checking the `activeCancel` state.
* `workspaceRelative` ensures the file is inside the first workspace folder.

**Notes**
* `cancelActiveInlineEdit` is triggered by the host's `anvil.cancel` handler.
* `reportError` displays an error message and offers to open the "Doctor" command.
* `askInstruction` claims the `activeCancel` slot while the input box is open.
* `finishEdit` logs a warning and aborts if the file version changes during generation.
* `runJob` catches errors during session creation and reports them via `reportError`.
