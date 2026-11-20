# Codebase tour

Anvil is a single npm package at the repository root. The package is the VS Code extension, bundled by esbuild into `dist/extension.js` (CommonJS, `vscode` external) and `dist/webview.js`. This document explains how the code is laid out and how the parts connect. For diagrams and module contracts, read [ARCHITECTURE.md](ARCHITECTURE.md). For design reasons, read [DECISIONS.md](DECISIONS.md).

## 1. Directory tree

```text
anvil/
  agent/                          TrueForge agent definitions
    anvil-coder.json              Agent mode: tool loop, approval-gated edits, subagents, compaction
    anvil-inline.json             Inline edit: no tools, one fenced replacement
  config/
    trueforge.example.json        Example providers and model chain (committed)
                                  trueforge.local.json is the gitignored copy you edit
  docs/                           Project documentation (see section 9)
    problem/                      The competition brief
    src/                          Per-file mirror of src/ and webview/ (index: docs/src/README.md)
  media/anvil.svg                 Activity bar icon
  openspec/changes/add-anvil-v1/  Specification change: proposal and capability specs
  scripts/
    setup-trueforge.mjs           Registers providers, the bridge (when ANVIL_MCP_TOKEN is set) and agents
    demo/setup-flask.sh           Clones pallets/flask at 3.1.3 and creates a venv for the demo
    demo/reset-flask.sh           Discards changes in the demo checkout between takes
  src/
    extension.ts                  Composition root: activation, wiring, command registration
    core/                         Pure TypeScript. Must not import vscode.
      config.ts                   AnvilConfig, DEFAULT_CONFIG, mergeConfig (clamping)
      paths.ts                    resolveInWorkspace, toRelative, PathError
      ledger.ts                   ApprovalLedger, canonicalKey, stableStringify
      transaction.ts              CheckpointStore: pre-images, undo, revertRun, conflicts
      diff/hunks.ts               computeHunks, applyHunks, previewContent, summarizeHunk
      edits/applyEdit.ts          simulateEdit for search/replace and whole-file writes
      inline/prompt.ts            Inline prompt, fenced-block extraction, indentation matching
      agent/events.ts             TurnReducer: TrueForge events to a view model
      agent/toolCalls.ts          resolveToolCall: unwraps deferred call_tool into the real tool call
      agent/fallback.ts           classifyFailure and ModelRelay (retry, switch, give up)
      context/
        types.ts                  Shared context types (Chunk, ContextItem, ContextPack, ...)
        tokenize.ts               Identifier-aware tokenizer (camelCase, snake_case, stop-words)
        symbols.ts                Regex symbol extraction per language family
        chunker.ts                Chunks files at symbol boundaries (60-line windows as fallback)
        bm25.ts                   In-memory BM25 index
        imports.ts                Import extraction and resolution for the import graph
        walker.ts                 Workspace walk: .gitignore, default excludes, size limit
        codeIndex.ts              CodeIndex: contents, symbols, chunks, BM25, grep, neighbors, repo map
        rank.ts                   Candidate signals and weighted Reciprocal Rank Fusion
        assemble.ts               Budgeted Context Pack and renderContextPack
        mentions.ts               Parses @file and @symbol mentions
    trueforge/                    The TrueForge client (the only code that talks to TrueForge)
      client.ts                   SDK factory (retries off) and the /healthz probe
      spec.ts                     Loads agent JSON, converts to SDK camelCase, sets the model
      setup.ts                    Idempotent registration of the bridge and both agents
      session.ts                  AnvilSession: turns, streaming, approvals, cancel, Model Relay
    mcp/                          The editor's capabilities, exposed to TrueForge as MCP tools
      server.ts                   HTTP listener, per-request MCP server, WorkspaceHost and WriteGate contracts
      tools.ts                    The ten tools: read, search and write-gated edit, plus run_command
      auth.ts                     Bearer-token and Origin checks
    host/                         VS Code adapters: the only place (with panel/ and extension.ts) that uses vscode
      workspaceHost.ts            WorkspaceHost implementation over VS Code APIs
      indexService.ts             Builds CodeIndex at activation; incremental updates from the file watcher
      runController.ts            Owns the chat session, the active run, checkpoints and panel messages
      approvalFlow.ts             Edit and command approvals; ledger entries; WriteGate fallbacks
      reviewController.ts         Native diff tabs, virtual documents, CodeLens, decisions queue
      reviewModel.ts              Review state without vscode: decisions, outcome, feedback
      inlineEdit.ts               The anvil.inlineEdit command and its live review
      fileStore.ts                FileStore over WorkspaceEdit (native undo) and save
      commandRunner.ts            Runs run_command child processes with timeouts and kill-on-cancel
      cappedOutput.ts             Bounded output buffer for command output
      panelEvents.ts              Maps turn view changes to panel messages; mention matching
      doctor.ts                   Doctor checks and the report text
      healthLoop.ts               Polls TrueForge every 15 s; triggers setup when it comes back
      config.ts                   Reads VS Code settings into AnvilConfig; change events
      statusBar.ts                Status bar item: model, indexing, running, TrueForge down
    panel/
      panelProvider.ts            WebviewViewProvider for the Anvil view
      protocol.ts                 HostToWebview and WebviewToHost message types
  webview/                        Panel UI in vanilla TypeScript and CSS, bundled to dist/webview.js
  test/
    unit/                         Vitest tests for pure modules
    integration/                  Vitest tests across modules; flask.retrieval.test.ts uses a real checkout
    e2e/                          Real-TrueForge suite (CI only); vitest.e2e.config.ts; scripted mock LLM
    vscode/                       @vscode/test-electron smoke suite (runTests.js, suite/index.js)
    fixtures/mini-flask/          Small Flask-shaped repository used by the tests
  .github/workflows/
    ci.yml                        Two-phase CI and the ci-ok gate
    build.yml                     Packages the .vsix and publishes releases on v* tags
  package.json                    Scripts, dependencies, contributed commands, keybindings, settings
  esbuild.mjs, tsconfig.json, eslint.config.mjs, vitest.config.ts, vitest.e2e.config.ts
  .prettierrc, .prettierignore, .nvmrc (22), .gitignore, LICENSE (MIT)
```

## 2. Dependency rule

`core` is the foundation and imports nothing from the rest of the project. The layers above it depend only downward:

- `core` never imports `vscode`. ESLint enforces this for `src/core/**`.
- `trueforge` and `mcp` import only `core`. Neither imports `host`, and neither imports `vscode`.
- `mcp` reaches the editor only through the `WorkspaceHost` and `WriteGate` interfaces, which `host` implements.
- `host` imports `core`, `trueforge`, `mcp` and `panel`.
- `panel` provides the webview view and the message types. It is imported by `host` and `extension.ts`.
- `extension.ts` is the composition root. It is the only file that wires all of the above together.

Because of this rule, most logic (diffs, edits, ledger keys, path checks, context ranking, failure classification) runs as plain Node code under unit tests, with no VS Code host needed.

## 3. Runtime objects and how they connect

`activate()` in `src/extension.ts` builds the runtime in this order:

1. **Token and config.** `getToken` reads or creates the 32-byte bridge token in SecretStorage. `readConfig()` loads the settings.
2. **Controllers.** `CommandRunner`, `ReviewController` (native diff editor and CodeLens), `AnvilStatusBar`, and `IndexService` (which owns the `CodeIndex`).
3. **RunController.** Owns the chat `AnvilSession`, the `ApprovalFlow` (which owns the `ApprovalLedger`), and the `CheckpointStore` (backed by `VsCodeFileStore`). It implements `WriteGate` for the bridge and `RunHooks` for the session.
4. **VsCodeWorkspaceHost.** Implements `WorkspaceHost`. Its writes go to `RunController.applyWrite`, so every write is recorded in the checkpoint store.
5. **MCP bridge.** `startBridge` serves the ten tools at `http://127.0.0.1:<mcpPort>/mcp`, using the `WorkspaceHost` and the `RunController` as the `WriteGate`.
6. **HealthLoop.** Polls TrueForge every 15 seconds. When TrueForge becomes reachable, it runs `ensureSetup` to register the bridge and the agents.
7. **Panel, inline edit, commands.** `PanelProvider` is registered as the webview view. `registerInlineEdit` binds `anvil.inlineEdit`, and `registerCommands` binds the rest.

Contracts that connect these objects:

| Interface | Implemented by | Used by |
| --- | --- | --- |
| `WorkspaceHost` (`mcp/server.ts`) | `VsCodeWorkspaceHost` (`host/workspaceHost.ts`) | MCP tools |
| `WriteGate` (`mcp/server.ts`) | `RunController` (delegates to `ApprovalFlow.gate`) | MCP write and command tools |
| `RunHooks` (`trueforge/session.ts`) | `RunController.hooks` and the hooks in `host/inlineEdit.ts` | `AnvilSession.run` |
| `FileStore` (`core/transaction.ts`) | `VsCodeFileStore` (`host/fileStore.ts`) | `CheckpointStore` |
| `FailureKind` and `ModelRelay` (`core/agent/fallback.ts`) | Pure logic | `AnvilSession` |

## 4. Data flow of an agent run

This is the path of one request from the Anvil panel (Task B in the demo). The sequence diagram is in [ARCHITECTURE.md](ARCHITECTURE.md) section 3.1.

1. The panel posts `send`. `RunController.startRun` checks that no run is active and that `anvil.models` is set, then sets the `anvil.running` context key.
2. `buildInput` parses mentions with `parseMentions`, then calls `assembleContext(index, signals, contextBudget)`. It posts a `context` message, which drives the Context Inspector card.
3. The user message becomes the prompt followed by `renderContextPack(pack)`, which is an `<anvil_context>` block whose items carry their reasons.
4. `AnvilSession.run` creates the TrueForge session with the coder spec (`sessions.create`) on the first run, then calls `createTurnStream` with the user message.
5. TrueForge streams `model.message.delta` events. `TurnReducer` folds them into a view, and `diffTurn` turns the changes into `text`, `tool` and `thread` panel messages.
6. Read-only tool calls (`search_code`, `read_file` and the others) arrive at the bridge as MCP calls and are answered from the index or the file system. They need no approval.
7. An `edit_file` call causes TrueForge to emit `tool.approval_required` and pause the turn. `AnvilSession.answerPause` calls `RunHooks.onApproval`, which is `ApprovalFlow.onApproval`. That function simulates the edit against the current file, posts an approval card, and opens the hunk review through `ReviewController.review`.
8. The user's decision goes into the `ApprovalLedger`, keyed by `canonicalKey(tool, args)`. The session subscribes to the turn first, then sends `user.tool_approval` (allow when at least one hunk was accepted, deny otherwise).
9. TrueForge runs the tool call over MCP. `gatedWrite` checks that a run is active, then `WriteGate.resolveWrite` takes the ledger entry and confirms the file is unchanged. Only then does `host.applyWrite` run. That call writes through `WorkspaceEdit`, saves, and records a checkpoint with the before and after contents.
10. `turn.done` ends the run. `runFinished` is posted, and the timeline's `changes` list updates. If the run was cancelled and `cancelBehavior` is `revert`, `revertRun` restores its files.

If the model fails, `AnvilSession.runLoop` classifies the failure with `classifyFailure`. It then asks `ModelRelay.onFailure` whether to retry (after backoff), switch model (with `sessions.update` on the same session, after reverting the failed attempt's writes), or give up.

## 5. Data flow of an inline edit

Inline edit reuses the same session runner and review, with no tools. The flow is in [ARCHITECTURE.md](ARCHITECTURE.md) section 3.2.

1. `inlineEdit` takes the selection, or the enclosing symbol when nothing is selected, and asks for the instruction.
2. `runJob` opens a live review (`ReviewController.openLive`) and creates an `AnvilSession` for the `anvil-inline` spec.
3. `buildInlinePrompt` assembles the prompt: the file, the language, the code before and after the selection, the instruction, and definitions of names used in the selection (capped at 8 000 characters).
4. On each delta, `extractPartialReplacement` reads the code inside the unfinished fence. `stitch` puts it back between the untouched code, and `live.update` redraws the proposed document (throttled to 100 ms).
5. On `turn.done`, `extractReplacement` takes the last complete fenced block, or the whole text without fences. `live.finish` opens the per-hunk review.
6. Accepted hunks are written through `applyAccepted`, which calls `RunController.applyStandalone`. The write is recorded with a run id of the form `inline-<timestamp>`.

## 6. Where to make common changes

### Add an MCP tool

1. Register it in `src/mcp/tools.ts` with `server.registerTool`, a zod input schema and annotations. Follow the existing read tools for read-only tools and `registerWriteTools` for writes.
2. If the tool needs editor access that does not exist yet, add the method to `WorkspaceHost` in `src/mcp/server.ts` and implement it in `src/host/workspaceHost.ts`.
3. If the tool writes or runs something, route it through `gatedWrite` or `WriteGate` (never a direct write). Pass the arguments through unchanged, because the ledger key is a hash of them.
4. If TrueForge should pause the tool for approval, add its name to `require_approval_for_tools` in `agent/anvil-coder.json`.
5. Add an integration test in `test/integration` that calls the tool over real HTTP with fake host and gate objects.
6. Update the tool list in [ARCHITECTURE.md](ARCHITECTURE.md) section 4 and the mirror doc. `Doctor` checks for at least ten tools, which is a lower bound, so an extra tool does not break it.

### Add a message between the panel and the host

1. Add the type to `HostToWebview` or `WebviewToHost` in `src/panel/protocol.ts`.
2. For a message from the webview, handle it in `RunController.onPanelMessage`, or in the controller that owns the behaviour.
3. For a message to the webview, post it with `panel.post` (or `RunController`'s `post` dependency).
4. Render it in `webview/`. Escape all model text there. The markdown renderer exists to keep model output from becoming HTML (D-015).

### Add a setting

1. Declare it under `contributes.configuration.properties` in `package.json`, with a default and a description.
2. Add it to `AnvilConfig` and `DEFAULT_CONFIG` in `src/core/config.ts`, and to `mergeConfig` with a clamp if it is numeric.
3. Read it through `readConfig` in `src/host/config.ts`.
4. If it changes how the model chain behaves, add it to the comparison in `extension.ts` (`onConfigChange`), so that the chat session is reset.
5. Add it to the settings table in the README and to section 9 of [ARCHITECTURE.md](ARCHITECTURE.md).

### Add a command

Declare it in `contributes.commands` in `package.json`, then register it in `src/extension.ts`. Add its id to the `COMMANDS` list so that a failed activation still shows a warning instead of a dead entry.

## 7. Context engine at a glance

`CodeIndex` (`src/core/context/codeIndex.ts`) holds everything in memory: file contents, symbols, chunks, a BM25 index over chunks, path tokens and the import graph. Its `build` walks the workspace in parallel. `updateFile` and `removeFile` keep it current as files change.

`assembleContext` (`assemble.ts`) produces a `ContextPack` for each request, in this order:

1. Pins, limited to half the budget: the selection, `@file` mentions and `@symbol` mentions.
2. A repo-map skeleton, reserved at 10 percent of the budget before any other item is placed.
3. Ranked chunks from `rankCandidates` (`rank.ts`) fill the remaining room. Candidates come from BM25, symbol matches, path matches, editor and recent files, and import neighbours, combined with weighted Reciprocal Rank Fusion (k = 60).

Each item records its reason and token count. Candidates that do not fit are listed as dropped with the reason "over budget".

The pull tools (`search_code`, `find_symbol`, `grep`, `repo_map`) call the same `CodeIndex` methods, with result caps.

## 8. Test layout

| Directory | Runner | What it covers | How to run |
| --- | --- | --- | --- |
| `test/unit` | Vitest | Pure modules in `src/core` (hunks, edits, ledger, paths, transactions, context, fallback) | `npm run test:unit` |
| `test/integration` | Vitest | Several modules together, including the MCP bridge over HTTP, and `flask.retrieval.test.ts` | `npm run test:integration` (the Flask test needs `FLASK_REPO`) |
| `test/e2e` | Vitest (`vitest.e2e.config.ts`) | Real TrueForge with a scripted model; six scenarios run in CI. | `npm run test:e2e` |
| `test/vscode` | Mocha in `@vscode/test-electron` | Extension activation in a VS Code instance with `test/fixtures/mini-flask` open | `npm run test:vscode` (needs a display; use `xvfb-run -a` on Linux) |

`npm test` runs Vitest with `vitest.config.ts`, which covers unit and integration tests. Fixtures live in `test/fixtures/`.

## 9. Documentation map

- `docs/IDEA.md`: product idea and how each feature answers the brief.
- `docs/ARCHITECTURE.md`: diagrams, flows, module contracts (authoritative), the host and webview protocol, and the settings table.
- `docs/DECISIONS.md`: numbered decisions (D-001 onwards). Append only.
- `docs/PLAN.md`: phases and the parallel workstreams.
- `docs/TF_DOCS.md`: the TrueForge facts Anvil relies on, verified against its source.
- `docs/LOG.md`: dated work log.
- `docs/AGENTS.md`: rules for AI coding agents.
- `docs/WRITEUP.md`: the competition write-up draft.
- `docs/src/`: per-file mirror of the source tree (see docs/src/README.md).
