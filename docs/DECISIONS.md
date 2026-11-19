# Architectural Decision Record

Each decision lists its context, the decision itself, the alternatives considered, and its consequences.
Status is **Accepted** unless noted otherwise. New decisions are appended and never rewritten. A superseded
decision is marked as such and points to its replacement.

---

## D-001 — Build from scratch, not a fork
**Context.** The brief encourages reusing Cline, Continue or Roo Code for the editor side, but the agent loop must
be TrueForge, and judges score the delta from the fork point.
**Decision.** Start from scratch (README says "Starting point: from scratch"). Borrow *ideas* (Continue's
diff-review UX, Cline's tool cards, Claude Code's search/replace edit tool), not code.
**Alternatives.** Fork Continue (huge codebase, its own loop and indexing, which would all have to be ripped out);
fork Cline (tightly coupled to its own loop and providers).
**Consequences.** A small, auditable codebase where every line serves the TrueForge integration. Licence
is simple (MIT). We write our own small diff-review UI on top of the native diff editor instead of a custom renderer.

## D-002 — The extension hosts the MCP server (Streamable HTTP on 127.0.0.1)
**Context.** Editor capabilities must be MCP tools. TrueForge only connects to *remote* MCP servers (URL).
**Decision.** The extension runs an MCP server using `@modelcontextprotocol/sdk`'s Streamable HTTP transport in
stateless mode, on `127.0.0.1:<anvil.mcpPort>` (default 7801), path `/mcp`.
**Alternatives.** A separate stdio MCP process (TrueForge can't spawn stdio servers); a standalone daemon (it
would need IPC back to VS Code for diagnostics, review UI and documents).
**Consequences.** The tools have direct access to VS Code APIs (diagnostics, open documents, WorkspaceEdit).
The port must be stable because TrueForge stores the URL. Setup re-registers it if it changes.

## D-003 — The bridge is authenticated with a bearer token
**Context.** Any local process can reach a localhost port, and the bridge can write files and run commands.
**Decision.** Generate a 256-bit random token on first run, keep it in VS Code `SecretStorage`, and register it in
TrueForge as `auth: { type: 'header', headers: { Authorization: 'Bearer …' } }`. Compare with
`crypto.timingSafeEqual`. Bind to 127.0.0.1 only. Reject requests with an unexpected `Origin` header
(blocks DNS-rebinding from browsers).
**Consequences.** Setup must run once per machine (automatic on activation when TrueForge is reachable).

## D-004 — Sessions use inline agent specs; the repo files are the source of truth
**Context.** Named-agent sessions cannot change their model. Fallback must switch models without user
action, and ideally without losing the conversation.
**Decision.** `agent/anvil-coder.json` and `agent/anvil-inline.json` hold the definitions (model field is a
placeholder). Sessions are created with `{ agent: { spec } }`, where `spec.model.name` comes from the Model
Relay. The definitions are *also* registered as named agents during setup, so they are visible and loadable in
the TrueForge UI.
**Consequences.** Fallback uses `sessions.update(id, { agent: { spec } })`: same session, history kept, both
attempts visible in the Sessions view.

## D-005 — TrueForge tool approval drives the diff review
**Context.** The B4 anchor rewards "editor capabilities exposed as MCP tools, with TrueForge tool approval driving the
diff review".
**Decision.** `edit_file`, `write_file` and `run_command` are listed in `require_approval_for_tools` (and
annotated as write/destructive). On `tool.approval_required`, Anvil simulates the edit against current workspace
content, opens the per-hunk review, records the decision in the Approval Ledger, and answers with
`user.tool_approval` (allow if at least one hunk was accepted, otherwise deny with the rejected hunks as the reason). The MCP
tool then applies exactly the recorded final content and reports the rejected hunks to the agent.
**Alternatives.** Stage all writes in a virtual overlay and review at the end of the turn (simpler UI, but
approval would not drive the review, and the agent would reason over unreviewed state). Review inside the MCP
call (blocking HTTP request; again not driven by TrueForge approval).
**Consequences.** Partial acceptance is possible, and the agent gets precise feedback. The ledger key is a canonical hash of
the arguments, since the MCP request does not carry the tool-call id.

## D-006 — No-Silent-Write invariant enforced in the MCP layer as well
**Context.** Approvals can be bypassed (a session approval policy, a misconfigured agent spec without the gating
list, or someone else attaching the server to another agent).
**Decision.** The MCP write handlers never write unless `WriteGate.resolveWrite` returns content, either from the
ledger or from an interactive review it opens itself. They also refuse when no Anvil run is active.
**Consequences.** Defence in depth. Writes stay safe even if the TrueForge-side configuration is wrong.

## D-007 — Edits are search/replace (`edit_file`) with whole-file `write_file` as a fallback
**Context.** "Confidently edits a symbol that does not exist". The demo may also use weaker models.
**Decision.** `edit_file{path, old_string, new_string, replace_all?}` must match exactly once (exact first,
then a unique whitespace-tolerant line match). Otherwise it returns `NOT_FOUND` or `AMBIGUOUS` with a hint. `write_file`
creates new files or replaces small files.
**Consequences.** Grounded edits with fewer output tokens than whole-file rewrites. Small models handle the
format well.

## D-008 — Hybrid push + pull context with an explicit token budget
**Context.** Context assembly is "the intellectual core" (B1: budget, stated strategy, visible at work).
**Decision.** Push: the Context Engine assembles a budgeted Context Pack (pins, then RRF-ranked BM25, symbol, path,
editor-state and import-neighbour chunks, then a repo-map skeleton). Each item has a reason, and the pack is
rendered into the turn input and the Context Inspector. Pull: the same index is exposed as MCP search tools.
**Alternatives.** Embeddings (needs a provider call outside TrueForge or a local model; slower to index;
non-deterministic). Pure agentic search (weak models flounder, wasting turns).
**Consequences.** Deterministic, fast (milliseconds for 17k LOC), zero external calls, and explainable. Semantic recall is
weaker than embeddings, which we mitigate with identifier-aware tokenisation and symbol and path signals.

## D-009 — BM25 + regex symbol extraction instead of tree-sitter or LSP
**Context.** We need symbols for chunking, `find_symbol` and the repo map, in CI and without language extensions.
**Decision.** Regex extractors per language family, plus an indentation- and brace-based end-line heuristic.
**Alternatives.** web-tree-sitter (WASM grammars, bundle size, async init); the VS Code symbol provider
(depends on installed language extensions, unavailable in tests).
**Consequences.** Good enough for Python, TS and JS (the demo targets), and degrades gracefully elsewhere
(60-line windows).

## D-010 — Model Relay: client-side retry and fallback
**Context.** TrueForge has no model fallback (its LLM adapter uses `maxRetries: 0`). B3 rewards automatic fallback to a second model with
no user action and an unchanged workspace.
**Decision.** Classify each failure (`transient` / `model-fatal` / `harness-down` / `cancelled`). Retry transient failures with
backoff, switch models on model-fatal failures or exhausted retries, and give up with a clear message (plus Doctor) when the
harness itself is down. Before a retry or switch, roll back writes the failed attempt applied. A stall timeout
covers endpoints that hang instead of failing.
**Consequences.** Visible, explainable resilience. Configuring a chain is the user's job (`anvil.models`).

## D-011 — Runs are transactions; cancel reverts by default
**Context.** "A cancelled run leaves the workspace consistent, with no half-applied edits." A multi-file change
cancelled after two of three files is half-applied.
**Decision.** Each run records the pre-image of every file it writes. Cancel triggers `revertRun` (setting
`anvil.cancelBehavior = keep` opts out). Pending reviews are discarded, and late MCP writes are refused.
Restores detect conflicts (the file changed since the write) and skip them unless forced.
**Consequences.** Atomic runs. The same mechanism powers *Undo change* and *Revert run*.

## D-012 — No sandbox-dependent features (skills, Code Mode, large-response offloading)
**Context.** These need TrueForge's sandbox provider (Daytona, a cloud service). The brief requires local mode and
says the sandbox is optional.
**Decision.** Use deferred tool loading, dynamic subagents and compaction, which need no sandbox. Keep tool
outputs small at the source (windowed `read_file`, capped search results) instead of offloading.
**Consequences.** Fully local. The write-up explains why skills were not used.

## D-013 — Review UI = native diff editor + virtual documents + CodeLens
**Context.** Per-hunk accept and reject with a visible preview, robust across themes, fast.
**Decision.** Left side: an `anvil-original:` snapshot. Right side: an `anvil-proposed:` virtual document that
renders pending and accepted hunks. CodeLens on each hunk offers Accept / Reject, plus top-of-file Accept all / Reject
all. When every hunk is decided, the controller resolves. Inline edits reuse the controller (the right side
updates live during streaming).
**Alternatives.** Decorations that write proposal lines into the real buffer (Continue style) pollute the undo
stack and dirty files. A custom webview diff means reimplementing a diff viewer, which the brief explicitly discourages.
**Consequences.** Nothing touches the real document until accept. Native diff UX (inline or side-by-side per
user setting).

## D-014 — Applying accepted changes uses WorkspaceEdit + save
**Decision.** Accepted content is applied with a full-range `WorkspaceEdit` and `document.save()`.
**Consequences.** Native `Ctrl+Z` works for open documents, tests run against saved files, and the change is
recorded in the CheckpointStore for timeline undo.

## D-015 — Webview in vanilla TypeScript with a tiny safe markdown renderer
**Decision.** No React. One esbuild bundle. A minimal markdown subset (paragraphs, code fences, inline
code, bold/italic, lists, links rendered as text) built on escaped strings. Strict CSP.
**Consequences.** Small bundle, no XSS surface from model output, and simple to audit.

## D-016 — Single npm package, esbuild bundling, vitest
**Decision.** The extension is the root package. esbuild bundles `dist/extension.js` (CJS, `vscode` external)
and `dist/webview.js`. vitest runs unit and integration tests. `@vscode/test-electron` runs a smoke suite.
`@vscode/vsce` packages the `.vsix`.
**Consequences.** Fast builds (under 1 s), simple CI.

## D-017 — Inline edit needs no tool calling
**Context.** The organisers may repeat Task A live with a model of their choice.
**Decision.** `anvil-inline` has no MCP servers attached. The prompt contains the selection, its surroundings and relevant
definitions, and asks for one fenced code block. `extractReplacement` tolerates missing fences.
`iteration_limit` is 2; subagents, questions and generative UI are off.
**Consequences.** Works on any chat model, and has the fastest time to first token.

## D-018 — Two-phase CI, plus a separate build workflow
**Decision.** `ci.yml` runs on push to `**` and on pull requests. Phase 1, `quality`: typecheck, eslint, prettier check,
bundle. Phase 2, `integration` (needs phase 1): vitest unit + integration, the Flask retrieval check, the VS Code
smoke suite under xvfb, and the real-TrueForge e2e with a mock LLM. A final `ci-ok` job needs both phases, so the
tick means both passed. `build.yml` packages the `.vsix` as an artifact, and attaches it to a release on `v*` tags.

## D-019 — Real-TrueForge e2e test with a scripted mock LLM
**Context.** Eligibility depends on the loop really running on TrueForge. Unit tests with a mock SSE server don't
prove that.
**Decision.** In CI, start `npx @truefoundry/trueforge@latest` (SQLite in a temp dir), register a `custom`
OpenAI-compatible provider pointing at a tiny scripted mock (`/v1/chat/completions` with streamed tool calls), register
the bridge, and drive `AnvilSession` through search → edit (approval) → done. A second scenario chains a broken
provider and the mock to prove fallback.
**Consequences.** Verifies wire compatibility on every push. (Running TrueForge locally from the agent session was
blocked by policy, so CI is where this runs.)
