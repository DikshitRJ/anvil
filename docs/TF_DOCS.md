# TrueForge — Documentation Summary (for Anvil)

> Source: `github.com/truefoundry/trueforge` @ `0a7ae41` (2026-11-18), its `docs/` tree (mirrors trueforge.dev),
> server source (`packages/trueforge/src`), core runtime (`packages/trueforge-core/src`) and the generated
> TypeScript SDK `@truefoundry/trueforge-sdk@0.185.0`. Only what matters for building Anvil is kept here.
> Everything below was verified against source, not just prose docs.

## 1. What TrueForge is

TrueForge is an open-source **agent harness**: it owns the agent execution loop — model calls, MCP tool
calls, approvals, streaming, session state, context management, subagents — and exposes it through:

| Surface | Use in Anvil |
| --- | --- |
| HTTP API (`/api/v1/*`, OpenAPI at `/api/v1/openapi.json`) | Everything the extension does |
| TypeScript SDK `@truefoundry/trueforge-sdk` (Fern-generated, ESM + CJS) | Our client library |
| Chat UI (bundled, served at the same port) | Judges inspect the **Sessions** view (turns, tool calls, subagents) |

Run modes: **local** (`npx @truefoundry/trueforge@latest`, one process, SQLite, no login, port `8790`,
Node ≥ 22.14) and hosted (Postgres + Redis). Anvil targets local mode only (problem statement requirement).
Useful env: `PORT` / `--port`, `SQLITE_PATH` (DB location), `PUBLIC_BASE_URL`.

## 2. Core object model

```
Agent (definition) ─< Session (one issue/conversation) ─< Turn (one request) ─< Event ─< Delta
```

* **Agent spec** (`manifest`): `model` (only required field), `instructions`, `mcp_servers[]`, `skills[]`,
  `config{...}`, `response_format`, `messages` (seed). Saved by name (`agents.create/update`) **or passed inline**
  at session creation (`sessions.create({ agent: { spec } })`).
* **Session**: holds conversation context; turns chain automatically (`previous_turn_id: "auto"`).
  Only **one active turn per session**; a new message cancels a running turn.
  **Only inline-spec sessions may replace their `agent`** via `sessions.update` — named sessions cannot.
  → This is how Anvil switches model mid-conversation (fallback) without losing history.
* **Turn** lifecycle: `running → paused (needs user input) → running → done | cancelled | error`.
* **Event**: JSON objects on an SSE stream; every event has a monotonic ULID `id` (resume cursor) and a
  `thread_id` (`"main"`, a subagent thread id, or `null` for turn-level events).
* **Delta**: `model.message.delta` fragments share the base `model.message` id; merge with SDK helpers
  `isEventDelta` / `mergeEventDelta` (text and tool-call fragments merged by index).

## 3. SDK surface we use

```ts
import { TrueForge, TrueForgeApi, isEventDelta, mergeEventDelta } from '@truefoundry/trueforge-sdk';
const client = new TrueForge({ baseUrl: 'http://localhost:8790', timeoutInSeconds: 600 });

client.sessions.create({ agent: { spec } })                    // inline agent
client.sessions.update(sessionId, { agent: { spec } })         // swap model (inline sessions only)
client.sessions.createTurnStream(sessionId, { input: [{ type: 'user.message', content }] }, { abortSignal })
client.sessions.subscribeToTurn(sessionId, turnId, { afterEventId })   // resume / after answering a pause
client.sessions.createTurnEvents(sessionId, turnId, { events: [...] }) // answers to a paused turn
client.sessions.cancel(sessionId)                              // idempotent; ends stream with turn.done(cancelled)
client.sessions.listTurnEvents(sessionId, turnId)              // replay (deltas pre-merged)
client.agents.create/update/list                               // register the Anvil agent definitions
client.settings.mcpServers.createOrUpdate({ manifest })        // PUT /api/v1/settings/mcp-servers
client.settings.modelProviders.createOrUpdate({ manifest })    // PUT /api/v1/settings/model-providers
client.models.list()                                           // models available to agents
```

Request options: `abortSignal`, `maxRetries` (SDK default 2 for retryable HTTP), `timeoutInSeconds`.
Errors: `TrueForgeError { statusCode, message, body }`; network failures throw before any event.

## 4. Turn events (wire names; TS SDK camelCases them)

| Event | Meaning / key fields |
| --- | --- |
| `turn.created` | first event; `turn_id`, `previous_turn_id` |
| `mcp.initialize` | MCP connections up; `mcp_servers[{id,name,transport_type}]` |
| `model.message` | assistant message: `content`, `tool_calls[{id, function{name,arguments}, tool_info}]`, `finish_reason`, `usage{input_tokens_breakdown{harness,skills,instructions,tool_definitions,messages}}` |
| `model.message.delta` | streaming fragment of the above (live stream only) |
| `tool.response` | tool result; `tool_call_id`, `content` |
| `tool.approval_required` | gated calls: `tool_calls[{id, source_event_id}]` → look up name/args in the indexed `model.message` |
| `tool.response_required` | client-side tool (e.g. `ask_user_question`) needs an answer |
| `thread.created` / `thread.done` | subagent lifecycle; `title`, `parent{thread_id,tool_call_id}`, `agent_info.input` (generated instructions) |
| `turn.update` | `state.status: paused | running`; optional `metrics` |
| `turn.done` | terminal: `done{output, metrics}` · `cancelled{reason: client-cancelled | server-execution-timeout | cancelled-for-next-turn | abandoned}` · `error{message}` |
| `user.tool_approval` | our answer `{thread_id, tool_call_id, approval: {status:'allow'} | {status:'deny', reason}}` |
| `user.tool_approval_policy` | approve an MCP tool until `expire_at` (`allow_session`) |
| `user.tool_response` | answer to `ask_user_question` |

**Pause protocol** (0.185+): read until `turn.update{paused}`, remember last event id →
`subscribeToTurn(afterEventId)` **first**, then `createTurnEvents(answers)`, then read the subscription
until `turn.done` or the next pause. Subagent approvals carry the subagent's `thread_id`; echo it back.

**Tool-call shapes** (matters for approval matching):
* Preloaded MCP tool: `tool_info = { type: 'mcp', server_name, name }`, `function.arguments` = tool input JSON.
* Deferred MCP tool: `tool_info = { type: 'truefoundry-system', name: 'call_tool' }`, arguments
  `{ mcp_server, tool_name, input }`.

## 5. MCP servers

* TrueForge connects to **remote** MCP servers over `streamable-http` (or `sse`).
* Registration: `PUT /api/v1/settings/mcp-servers` with
  `{ manifest: { type: 'remote', name, url, description, auth?: { type: 'header', headers } | { type: 'dcr' } } }`.
  Header secrets are stored server-side and redacted in responses.
* Agent attachment (`mcp_servers[]` entry): `name`, `enable_tools` (`@all` | `@read-only` | names),
  `disable_tools`, `preload` (default `false` → deferred), `preload_tools` (eager subset),
  `require_approval_for_tools` (default `["@write","@destructive"]`; also `@all` or literal names).
  `@write`/`@destructive` rely on MCP tool annotations (`readOnlyHint`, `destructiveHint`); unlabeled tools are
  not gated, so Anvil lists its write tools **by name** as well as annotating them.
* `x-tfg-mcp-headers` request header can pass per-server invoke headers (not needed by Anvil).

## 6. Models

* Configured under Settings → Models or `PUT /api/v1/settings/model-providers`. Provider types: `openai`,
  `anthropic`, `google-gemini`, `fireworks`, `together`, `moonshot`, `zai`, `alibaba`, `truefoundry`, and
  **`custom`** (any OpenAI-compatible endpoint: Ollama, vLLM, Groq, OpenRouter, LiteLLM, gateways).
* Model FQN used in specs: `<provider-name>/<model-name>` (custom providers are named; well-known ones are
  named after their type). `model.params`: `max_tokens`, `temperature`, `top_p`, `top_k`,
  `parallel_tool_calls`, `reasoning_effort`, extra keys passed through.
* **No built-in model fallback** (docs list "automatic model selection" as planned) and the LLM adapter runs
  with `maxRetries: 0`. A failing provider surfaces as `turn.done{status:'error', message}`.
  → Resilience (retry + fallback chain) must be implemented by the client — Anvil's **Model Relay**.

## 7. Context-engineering features

| Feature | How it works | Config | Needs sandbox? |
| --- | --- | --- | --- |
| Deferred tool loading | Only server name/description in context; meta tools `list_tools`, `get_tool_info`, `get_tool_output_schema`, `call_tool` | `preload:false` (default), `preload_tools:[...]` | No |
| Dynamic subagents | Root calls `create_sub_agent`; parallel isolated contexts, only final result returns; one level deep; share MCP tools; their gated calls still pause for approval | `config.dynamic_sub_agents.enabled` (default true) | No |
| Compaction | LLM summary replaces older history at a token threshold (default 80% of context length or 50k) | `config.context_management.compaction` | No |
| Large tool-response offloading | Oversized tool output written to a sandbox file, preview kept | `config.context_management.large_tool_response` | Yes |
| Code Mode | Agent scripts MCP calls in Python inside the sandbox | sandbox | Yes |
| Skills | git-backed `SKILL.md`, progressive disclosure | `skills[]` | Yes |

Sandbox provider today is Daytona (cloud) → out of scope for a local-only submission; Anvil uses deferred
tools, subagents and compaction, and keeps tool outputs small at the source instead of offloading.

## 8. Other agent config

`ask_user_questions` (built-in `ask_user_question` tool, default on), `generative_ui` (default on — off for
Anvil, the editor renders its own UI), `web_search`, `memory`, `iteration_limit` (1–1024; default 512),
`response_format` (`text` | `json_object` | `json_schema`).

## 9. Implications for Anvil (summary)

1. Extension = TrueForge **client** (SDK) + **MCP server** (editor capabilities). No direct model calls.
2. Write tools are approval-gated in the agent spec → `tool.approval_required` opens Anvil's per-hunk
   **diff review**; the decision is sent back as `user.tool_approval`.
3. Streaming = `model.message.delta`; cancellation = `sessions.cancel` + local abort + rollback.
4. Fallback = classify `turn.done{error}` / transport errors → backoff → `sessions.update` with next model.
5. Context = Anvil's own retrieval (push) + MCP search tools (pull) + TrueForge subagents/deferred tools/compaction.
