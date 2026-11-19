# `src/host/inlineEdit.ts`

**Purpose**
This file manages the inline edit workflow for the Anvil tool. It converts a user selection into a live whole-file diff and performs a per-hunk review.

**Exports**
* cancelActiveInlineEdit(): boolean - function and returns a boolean. It cancels the current inline edit operation.
* registerInlineEdit(context: vscode.ExtensionContext, deps: InlineEditDeps): void - function and returns void. It registers the `anvil.inlineEdit` command in the VS Code extension context.

**Collaborators**
* Imports: `vscode`, `../core/inline/prompt`, `../core/context/codeIndex`, `../trueforge/session`, `./reviewController`.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The file uses a character budget of 8000 for context building.
* It only processes files with the `file` URI scheme.
* It cancels the session and live review if the user requests a cancellation.
* It prevents applying the edit if the file version changes during generation.
* It shows a warning message if the model switch fails.
* It shows an error message and offers to open the "Doctor" tool on failure.

**Notes**
* The `lineSelection` function handles empty selections by finding the nearest symbol.
* The `buildContext` function filters out module symbols.
