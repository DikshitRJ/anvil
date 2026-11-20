# `src/host/approvalFlow.ts`

**Purpose**
Approval logic for agent tool calls: per-hunk review of file edits, user approval of shell commands, and the `WriteGate` fallbacks that guarantee no silent writes.

**Exports**
- `ApprovalDeps`: `root`, `review` (ReviewController), `readFile(rel)`, `post(msg)`, `runId()`.
- `ApprovalFlow`: `onApproval(call)`, `answer(id, allow)`, `rejectAllPending()`, `clear()`, `ledger`, `gate` (`resolveWrite`, `authorizeCommand`).

**Collaborators**
- Imports: `vscode`, `core/agent/toolCalls`, `core/edits/applyEdit`, `core/ledger`, `core/paths`, `mcp/server` (`WriteGate` type), `panel/protocol`, `trueforge/session` (`ApprovalDecision`), `./panelEvents`, `./reviewController`.
- Used by: `runController.ts`; `gate` is passed to the MCP server.

**Key behaviour and invariants**
- `onApproval` handles `edit_file`/`write_file` (edit approval) and `run_command` (command approval); every other tool is allowed. Any thrown error becomes a denial: `ReviewCancelledError` gives reason "cancelled", others their message.
- Edit approval: resolves the path inside the workspace (`PathError` becomes a denial), reads the current file, simulates the edit (`EditError` becomes denial `CODE: message`), posts an `approval` card, then awaits `review.review({source:'agent'})`. `content === null` means rejected: deny with the user's feedback or "The user rejected this change." Otherwise the result (final content, hunk total, feedback) is stored in the ledger under a run-scoped key, with the original content remembered, and the call is allowed. `approvalResolved` reports accepted/total hunks.
- Command approval: posts a `command` approval card and also an information toast with Allow/Deny; whichever is answered first wins (`answer` is idempotent, a second answer is ignored). Allowed commands are remembered in `approvedCommands` (run-scoped key) for the later `authorizeCommand` call. Denial reason: "The user denied running this command."
- `gate.resolveWrite`: takes (consumes) the ledger entry; if the file is still identical to the original that was reviewed, it returns the approved content and feedback without asking again. If the file changed in between, or no approval exists, it opens a fresh review, so nothing is written unreviewed.
- `gate.authorizeCommand`: consumes a pre-approved command once, otherwise asks the user now (`cmd-N` ids).
- `rejectAllPending` answers every outstanding command prompt `false` (used on cancel). `clear` empties the ledger, originals and approved commands.

**Notes**
- Missing input fields default to empty strings; `replace_all` is honoured only when exactly `true`.
