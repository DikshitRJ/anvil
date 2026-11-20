# agent-mode Specification

## Purpose
A sidebar panel where one request drives the anvil-coder TrueForge agent through a tool loop that discovers and edits several files without the user naming them, with a transcript of streamed text, tool calls, subagents and approvals.

## Requirements

### Requirement: Agent panel
The extension SHALL contribute a sidebar webview panel where a single request drives the `anvil-coder` TrueForge agent
through a tool loop until the turn finishes, is cancelled, or the iteration limit is reached.

#### Scenario: Multi-file change without naming files
- **WHEN** the user sends a request that requires changes to three or more files without naming them
- **THEN** the agent discovers the files through MCP search and read tools and proposes edits to each of them

### Requirement: Transcript rendering
The panel SHALL render streamed assistant text, tool calls with status and a result preview, subagent threads, approvals,
model switches, and the final status with token metrics.

#### Scenario: Tool call shown
- **WHEN** the agent calls `search_code`
- **THEN** a tool card shows the query, a running status, and then a result preview

### Requirement: TrueForge session link
The panel SHALL offer a link that opens the current TrueForge session in the TrueForge UI.

#### Scenario: Open session
- **WHEN** the user clicks "Open in TrueForge"
- **THEN** the browser opens `<trueforgeUrl>/sessions/<sessionId>`

### Requirement: Multi-turn conversations
Follow-up messages SHALL be sent as new turns in the same TrueForge session until the user starts a new chat.

#### Scenario: Follow-up
- **WHEN** the user sends a second message
- **THEN** it is created as a turn chained to the previous one in the same session
