# `src/core/agent/toolCalls.ts`

**Purpose**
Resolves a raw TrueForge tool call to `{server, tool, input}`, unwrapping the deferred `call_tool` wrapper.

**Exports**
- `RawToolCall`: `id`, `function {name, arguments (JSON string)}`, optional `toolInfo {type, name, serverName}`.
- `ResolvedToolCall`: `callId`, `threadId`, optional `server`, `tool`, `input`.
- `resolveToolCall(call, threadId)`.

**Collaborators**
- Imports: none.
- Used by: `events.ts`, run controller and approval flow.

**Key behaviour and invariants**
- Arguments are parsed as JSON; invalid JSON, arrays, null or non-objects become `{}`.
- `toolInfo.type === 'truefoundry-system'` with name `call_tool`: `server` is `args.mcp_server`, `tool` is `args.tool_name` (falls back to the function name), `input` is `args.input` (object, else `{}`). Non-string or empty values are `undefined`.
- `toolInfo.type === 'mcp'`: `server` is `toolInfo.serverName`, tool is `toolInfo.name` (falls back to the function name), input is the parsed arguments.
- Anything else: tool is the function name and input the parsed arguments.

**Notes**
- Never throws.
