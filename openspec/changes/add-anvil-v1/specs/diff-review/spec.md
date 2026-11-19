## ADDED Requirements

### Requirement: Approval-driven review
Write tools (`edit_file`, `write_file`) SHALL be approval-gated in the TrueForge agent spec, and every
`tool.approval_required` for them MUST open a per-hunk review before any answer is sent.

#### Scenario: Agent proposes an edit
- **WHEN** TrueForge emits `tool.approval_required` for `edit_file`
- **THEN** the extension opens a diff with Accept and Reject CodeLens on each hunk

### Requirement: Partial acceptance
The extension SHALL apply exactly the accepted hunks and report the rejected hunks back to the agent.

#### Scenario: One of two hunks rejected
- **WHEN** the user accepts hunk 1 and rejects hunk 2
- **THEN** `user.tool_approval` allow is sent, the MCP tool writes content containing only hunk 1, and its result lists hunk 2 as rejected

#### Scenario: All hunks rejected
- **WHEN** the user rejects every hunk
- **THEN** `user.tool_approval` deny is sent with the rejected hunks as the reason and nothing is written

### Requirement: No silent writes
The MCP write handlers MUST NOT write content that was not approved through the ledger or an interactive review, and MUST refuse writes when no run is active.

#### Scenario: Approval bypassed
- **WHEN** the MCP `edit_file` handler is invoked without a matching ledger entry
- **THEN** it opens an interactive review and blocks until the user decides

### Requirement: Undo
Every applied change SHALL be recorded in a checkpoint timeline supporting undo per change and revert per run, with conflict detection.

#### Scenario: Undo applied change
- **WHEN** the user clicks "Undo" on an applied change whose file is unchanged since
- **THEN** the file is restored to its previous content (or deleted if it was created)
