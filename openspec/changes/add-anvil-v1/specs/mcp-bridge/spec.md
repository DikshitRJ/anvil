## ADDED Requirements

### Requirement: Local streamable HTTP MCP server
The extension SHALL run an MCP server (Streamable HTTP, stateless) bound to 127.0.0.1 on `anvil.mcpPort`, at path `/mcp`.

#### Scenario: Tool listing
- **WHEN** an authorized MCP client lists tools
- **THEN** it receives read_file, list_files, search_code, grep, find_symbol, repo_map, get_diagnostics, edit_file, write_file and run_command

### Requirement: Authentication
Requests MUST carry `Authorization: Bearer <token>`, where the token is stored in SecretStorage. Other requests SHALL be rejected with 401.

#### Scenario: Missing token
- **WHEN** a request arrives without the bearer token
- **THEN** the server responds 401 and runs no tool

### Requirement: Workspace confinement
All tool paths MUST resolve inside the workspace root. Escapes SHALL return an error.

#### Scenario: Path traversal
- **WHEN** `read_file` is called with `../../etc/passwd`
- **THEN** the tool returns an error and reads nothing

### Requirement: Command execution safety
`run_command` SHALL require approval, run in the workspace with a timeout, cap its output, and be killed on cancel.

#### Scenario: Timeout
- **WHEN** a command exceeds `anvil.commandTimeoutSec`
- **THEN** it is killed and the result reports the timeout with partial output

### Requirement: Automatic registration
On activation, when TrueForge is reachable, the extension SHALL register (create or update) the MCP server and the agent definitions.

#### Scenario: First run
- **WHEN** the extension activates with TrueForge running
- **THEN** `anvil-editor` appears under TrueForge connectors, and `anvil-coder` and `anvil-inline` appear under agents
