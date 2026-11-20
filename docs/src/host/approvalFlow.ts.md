# `src/host/approvalFlow.ts`

**Purpose**
This file manages the approval workflow for agent actions including file edits and command executions. It handles per-hunk reviews, maintains an approval ledger, and provides fallbacks for the WriteGate system.

**Exports**
* ApprovalDeps (interface): Defines the dependencies required by the ApprovalFlow class.
* ApprovalFlow (class): Manages the logic for approving or denying agent tool calls.

**Collaborators**
* Imports:
    * `vscode`: Used to show information messages for command approvals.
    * `../core/agent/toolCalls`: Provides the `ResolvedToolCall` type.
    * `../core/edits/applyEdit`: Provides `simulateEdit`, `EditError`, and `EditOp` for processing file changes.
    * `../core/ledger`: Provides `ApprovalLedger` and `scopedKey` for tracking approved actions.
    * `../core/paths`: Provides `PathError`, `resolveInWorkspace`, and `toRelative` for path manipulation.
    * `../mcp/server`: Provides the `WriteGate` type.
    * `../panel/protocol`: Provides the `HostToWebview` type.
    * `../trueforge/session`: Provides the `ApprovalDecision` type.
    * `./panelEvents`: Provides `reviewOutcome` and `summarizeTool` for UI communication.
    * `./reviewController`: Provides `ReviewCancelledError` and `ReviewController`.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `onApproval` routes `edit_file` and `write_file` to `approveEdit`, and `run_command` to `approveCommand`.
* `approveEdit` calculates relative paths using `this.d.root` and `toRelative`.
* `approveEdit` simulates edits using `simulateEdit` and captures the original content before review.
* `approveCommand` uses `vscode.window.showInformationMessage` to prompt the user for command execution.
* `askCommand` generates a unique ID prefixed with `cmd-` and increments `cmdSeq` for pending commands.
* `gate.resolveWrite` checks the `ledger` and `originals` map to see if a file change was previously approved.
* `gate.authorizeCommand` checks the `approvedCommands` set before prompting for a new command.
* `clear` resets the `ledger`, `originals` map, and `approvedCommands` set.
* `rejectAllPending` iterates through all keys in the `pending` map and resolves them as `false`.

**Notes**
* `onApproval` catches `ReviewCancelledError` and returns a "cancelled" reason.
* `onApproval` catches `PathError` during path resolution and returns the error message as a denial.
* `onApproval` catches `EditError` during simulation and returns the error code and message.
* `askCommand` handles the `cwd` property in command input to format the detail string.
* `toEditOp` defaults missing input fields to empty strings.
