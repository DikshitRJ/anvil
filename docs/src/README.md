# Source documentation index

> Drafted with OpenCode + Ollama gemma4:12b; verified line-by-line against the source by Claude Sonnet on 2026-11-20.

Per-file mirror of `src/**` and `webview/**`. Each page mirrors one source file (`webview/*.ts` pages live in `webview/`).

## src

| File | Purpose |
| --- | --- |
| [extension.ts](extension.ts.md) | Composition root: boots index, MCP bridge, TrueForge client, run controller, panel, review, inline edit and commands. |

## core

| File | Purpose |
| --- | --- |
| [core/config.ts](core/config.ts.md) | Defines the Anvil settings type, defaults, and `mergeConfig` which clamps numeric values. |
| [core/paths.ts](core/paths.ts.md) | Lexical guard that keeps tool paths inside the workspace (no escape, no NUL). |
| [core/ledger.ts](core/ledger.ts.md) | Single-use review-approval ledger keyed by run id and a hash of tool and args, 10 minute TTL. |
| [core/transaction.ts](core/transaction.ts.md) | Checkpoint store that records applied edits for single undo and whole-run revert with conflict detection. Restores run one at a time. |
| [core/fileList.ts](core/fileList.ts.md) | Filters the indexed file list by directory prefix, glob and limit for `list_files`. |

## core/diff, core/edits, core/inline

| File | Purpose |
| --- | --- |
| [core/diff/hunks.ts](core/diff/hunks.ts.md) | Computes change-only line hunks, applies or previews a subset, and summarises hunks (EOL aware). |
| [core/edits/applyEdit.ts](core/edits/applyEdit.ts.md) | Simulates `write` and `replace` edits on text (exact then whitespace-tolerant match, rejecting inconsistent indentation) without touching disk. |
| [core/inline/prompt.ts](core/inline/prompt.ts.md) | Builds the inline-edit prompt and extracts and indents the model's replacement code. |

## core/agent

| File | Purpose |
| --- | --- |
| [core/agent/events.ts](core/agent/events.ts.md) | `TurnReducer`: folds raw SDK turn events into a UI-friendly `TurnView`. |
| [core/agent/toolCalls.ts](core/agent/toolCalls.ts.md) | Resolves raw tool calls (including the `call_tool` wrapper) to server, tool and input. |
| [core/agent/fallback.ts](core/agent/fallback.ts.md) | Classifies failures and runs the Model Relay (retry with backoff, then switch model, or give up). |

## core/context

| File | Purpose |
| --- | --- |
| [core/context/types.ts](core/context/types.ts.md) | Type definitions for symbols, chunks, hits, mentions, signals and context packs. |
| [core/context/tokenize.ts](core/context/tokenize.ts.md) | Identifier-aware tokenizer (camel/snake split, stop words, light stemming). |
| [core/context/symbols.ts](core/context/symbols.ts.md) | Regex symbol extraction for Python, Ruby, Markdown, RST; dispatches brace languages. |
| [core/context/symbolsBrace.ts](core/context/symbolsBrace.ts.md) | Regex symbol extraction for TS/JS, Go, Java/Kotlin/C#, Rust and C/C++. |
| [core/context/chunker.ts](core/context/chunker.ts.md) | Splits files into retrieval chunks aligned with symbol boundaries. |
| [core/context/bm25.ts](core/context/bm25.ts.md) | Incremental BM25 inverted index. |
| [core/context/walker.ts](core/context/walker.ts.md) | Walks the workspace honouring default ignores, nested `.gitignore`, size and file-count limits. |
| [core/context/imports.ts](core/context/imports.ts.md) | Extracts and resolves Python and TS/JS imports for the one-hop import graph. |
| [core/context/rank.ts](core/context/rank.ts.md) | Weighted Reciprocal Rank Fusion of BM25, symbol, path, editor and neighbour signals. |
| [core/context/codeIndex.ts](core/context/codeIndex.ts.md) | In-memory index with search, symbol lookup, safe grep, import neighbours and repo map. |
| [core/context/mentions.ts](core/context/mentions.ts.md) | Parses `@file` (bare or quoted) and `@symbol` mentions from the prompt and formats file mentions for autocomplete. |
| [core/context/assemble.ts](core/context/assemble.ts.md) | Assembles the budgeted context pack (pins, ranked chunks, repo map) and renders `<anvil_context>`. |
| [core/context/window.ts](core/context/window.ts.md) | Trims an oversized chunk to a line window around the best query matches. |

## mcp

| File | Purpose |
| --- | --- |
| [mcp/auth.ts](mcp/auth.ts.md) | Constant-time bearer-token check and loopback-only Origin check. |
| [mcp/server.ts](mcp/server.ts.md) | Workspace and write-gate contracts, stateless per-request MCP server and secured loopback HTTP listener. |
| [mcp/tools.ts](mcp/tools.ts.md) | The ten MCP tools: read, list, diagnostics, search, grep, symbol, repo map, gated edit/write, gated command. |

## trueforge

| File | Purpose |
| --- | --- |
| [trueforge/client.ts](trueforge/client.ts.md) | Creates the TrueForge SDK client (no SDK retries, dedicated transport) and probes `/healthz`. |
| [trueforge/transport.ts](trueforge/transport.ts.md) | Undici agent that gives SDK requests the full ten-minute header and body limits, so quiet compaction streams survive. |
| [trueforge/session.ts](trueforge/session.ts.md) | Runs one request as a TrueForge turn: streaming, stall watchdog, approvals, cancel and model relay. |
| [trueforge/setup.ts](trueforge/setup.ts.md) | Idempotently registers the MCP server and the agents in TrueForge. |
| [trueforge/spec.ts](trueforge/spec.ts.md) | Loads agent JSON definitions and converts them to SDK specs. |

## panel

| File | Purpose |
| --- | --- |
| [panel/protocol.ts](panel/protocol.ts.md) | Message types between extension host and webview. |
| [panel/panelProvider.ts](panel/panelProvider.ts.md) | Hosts the strict-CSP webview, with a ready-gated queue and state replay. |
| [panel/messageQueue.ts](panel/messageQueue.ts.md) | Pure outbound queue helper: coalesces text snapshots and caps length. |

## host

| File | Purpose |
| --- | --- |
| [host/approvalFlow.ts](host/approvalFlow.ts.md) | Per-hunk edit approval, command approval, and the write-gate fallbacks. |
| [host/cappedOutput.ts](host/cappedOutput.ts.md) | Keeps the first 16 K and last 48 K characters of a stream. |
| [host/commandRunner.ts](host/commandRunner.ts.md) | Runs shell commands with capped output, timeout and process-group kill. |
| [host/config.ts](host/config.ts.md) | Reads `anvil.*` settings into `AnvilConfig` and notifies on change. |
| [host/doctor.ts](host/doctor.ts.md) | Diagnostic checks (TrueForge, bridge, registration, agents, models, index) and report formatting. |
| [host/fileStore.ts](host/fileStore.ts.md) | `FileStore` over `WorkspaceEdit` (native undo, dirty-buffer aware). |
| [host/healthLoop.ts](host/healthLoop.ts.md) | Polls TrueForge health every 15 s and fires change and came-up callbacks. |
| [host/indexService.ts](host/indexService.ts.md) | Owns the `CodeIndex`: initial build plus debounced watcher updates. |
| [host/inlineEdit.ts](host/inlineEdit.ts.md) | The `anvil.inlineEdit` command: streamed rewrite into a live diff with per-hunk review. |
| [host/panelEvents.ts](host/panelEvents.ts.md) | Pure panel helpers: turn diffs, tool summaries, mention ranking, ignored paths. |
| [host/realPath.ts](host/realPath.ts.md) | Symlink-escape guard for reads. |
| [host/reviewController.ts](host/reviewController.ts.md) | Diff editor and CodeLens UI for per-hunk review, queueing and cancel. |
| [host/reviewModel.ts](host/reviewModel.ts.md) | vscode-free review state: decisions, outcome, feedback and hunk anchors. |
| [host/runController.ts](host/runController.ts.md) | Owns session, checkpoints and the active run; cancel, revert and retry policy; implements `WriteGate`. |
| [host/statusBar.ts](host/statusBar.ts.md) | Status bar item for model, indexing, running and TrueForge-down states. |
| [host/workspaceHost.ts](host/workspaceHost.ts.md) | `WorkspaceHost` backed by VS Code: guarded reads, indexed listing, diagnostics. |

## webview

| File | Purpose |
| --- | --- |
| [webview/main.ts](webview/main.ts.md) | Webview entry: host messages to reducer to render, DOM events to host messages. |
| [webview/state.ts](webview/state.ts.md) | Pure reducer from host messages to panel state. |
| [webview/render.ts](webview/render.ts.md) | Renders state into the DOM with keyed patching. |
| [webview/markdown.ts](webview/markdown.ts.md) | Safe minimal markdown renderer (no links, images or raw HTML). |
