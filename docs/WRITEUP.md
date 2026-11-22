# Anvil: write-up

*An editor-native coding agent whose agent loop runs on TrueForge.*

Team: Baddie Janta Party · Team ID TM-6E1011CED75 · Repository: https://github.com/DikshitRJ/anvil (MIT) · Demo video (4:00): https://youtu.be/ZELjUlwCsW4

## 1. Team

| Member | College / employer | GitHub |
| --- | --- | --- |
| Dikshit Rishi Jain | NIT Surathkal | [@DikshitRJ](https://github.com/DikshitRJ) |
| Jayaditya | University of Windsor, Canada | [@Jay-Aditya-16](https://github.com/Jay-Aditya-16) |
| Anmol Raj | IIT Bombay | [@anmxlr](https://github.com/anmxlr) |
| Riza Mohamed T | University of Western Australia | [@codewithriza](https://github.com/codewithriza) |

Team name: Baddie Janta Party. Team ID: TM-6E1011CED75. Demo: [youtu.be/ZELjUlwCsW4](https://youtu.be/ZELjUlwCsW4) (4:00).

## 2. Starting point

From scratch. There is no upstream repository and no fork commit. Anvil is released under the MIT License. We borrowed ideas, not code: Continue's diff-review UX, Cline's tool cards, Claude Code's search/replace edit format, and opencode's panel patterns. The agent loop is TrueForge, and the extension never runs a loop of its own. That is deliberate: the brief makes an upstream loop an eligibility failure, and a harness lets us spend the month on the two hard parts, what the model sees and how safely its changes land (D-001).

The repository is 7,442 lines of TypeScript and CSS in `src/` and `webview/`, with 5,230 lines of tests: 250+ Vitest unit and integration cases, a real-TrueForge e2e suite and a VS Code smoke suite. Ten editor tools are exposed over MCP. ESLint enforces the dependency rule: `src/core` is pure TypeScript and may not import `vscode`, and `src/mcp` reaches the editor only through the `WorkspaceHost` and `WriteGate` interfaces. That keeps the core testable without an editor and the bridge replaceable.

## 3. Architecture on TrueForge

Anvil is a TrueForge client and an MCP server. It has no model code.

- **Client.** The extension uses `@truefoundry/trueforge-sdk` to create sessions with an inline agent spec: `anvil-coder` for agent mode and `anvil-inline` for inline edit. It sends turns, streams `model.message.delta` events into the panel and the diff, answers approval pauses, cancels turns, and switches model with `sessions.update` on the same session. It never calls a model provider.
- **Editor as MCP tools.** The extension runs a stateless Streamable HTTP MCP server inside the extension host on `127.0.0.1:7801`, guarded by a random bearer token (constant-time compare) and an Origin check. Every path is resolved against the workspace root; `..`, absolute-outside and NUL escapes are rejected, and symlinks are checked. TrueForge connects to it as the registered remote server `anvil-editor`. The server exposes ten tools:
  - Read-only, no approval: `read_file` (250-line window, 16 KB cap), `list_files`, `search_code`, `grep`, `find_symbol`, `repo_map`, `get_diagnostics`.
  - Gated by approval: `edit_file`, `write_file`, `run_command`. These are listed in `require_approval_for_tools`.
- **Approval drives the review.** When the agent calls `edit_file`, `write_file` or `run_command`, TrueForge pauses the turn with `tool.approval_required`. For an edit, Anvil simulates the change (exact match first, then a unique whitespace-tolerant line match), computes hunks, opens VS Code's native diff with per-hunk CodeLens (Accept/Reject, `Alt+Y` / `Alt+N`, Accept all/Reject all), and answers `user.tool_approval` with allow (if at least one hunk was accepted) or deny (with the rejected hunks as the reason). The MCP handler applies only the accepted content. It checks the approval ledger again. If no recorded decision matches the call, it opens the review itself and blocks until the user decides, so an approval that bypasses the UI still cannot write unreviewed content.
- **Harness features used, and why:**
  - *Tool approval* makes the review the single path to disk; it is the safety mechanism, not an afterthought.
  - *Deferred tool loading.* Four core tools are preloaded (`search_code`, `read_file`, `edit_file`, `write_file`). The rest are discovered on demand, which keeps the root context small.
  - *Dynamic subagents.* The coder may delegate broad reconnaissance, such as how CLI commands are registered and tested, to a subagent that returns only a summary. Approvals from a subagent are routed by thread id.
  - *Compaction.* Older history is summarised at TrueForge's default trigger (80% of the model's context window), so long sessions survive on 16k local models and large hosted models alike. The stall watchdog is paused while TrueForge compacts.
  - *sessions.update for fallback.* When the Model Relay switches model, it updates the same session's spec. History is kept, and the session shows both attempts.
- **The invariant.** No write reaches disk without a recorded, run-scoped approval. The ledger key is `sha256(tool + "\n" + stableStringify(args))`, scoped by run id, with a 10-minute TTL and take-once semantics. A late write after cancellation is refused because the run is no longer active. Every write is recorded with before and after text; undo restores `before` only if the file still equals `after`, and `revertRun` walks a run in reverse using the earliest `before` per file.
- **Streaming and cancellation.** `AbortController.abort()` stops SSE reading immediately, so the editor never blocks; `sessions.cancel(id)` is best effort. Pending reviews are rejected, POSIX command process groups are killed, and the run's files are restored (default `cancelBehavior = revert`). The panel reports "Cancelled — N files restored."
- **Model Relay timings.** Failures are classified from TrueForge's error text, status and phase. Transient failures retry with 0.5 s / 1.5 s / 4 s backoff.
- **Inline edit is a different agent.** `anvil-inline` has no MCP servers, temperature 0 and an iteration limit of 2. It receives the selection, its surrounding code and definitions of symbols the selection names (about 2,000 tokens), and must return one fenced code block. The diff re-renders on every delta (throttled to about 10 Hz) using `extractPartialReplacement`, which is safe inside an unterminated fence; on `turn.done`, `extractReplacement` produces the final text. Scope Lock restricts the replacement to the selected line range. Accepted hunks are applied through `WorkspaceEdit`, so native undo works, and are recorded in the timeline.
- **Trust boundaries.** The webview is a sandboxed iframe with a nonce-only CSP, no remote scripts, escaped model text and a `postMessage` protocol. The extension host has full workspace access, but all writes funnel through `WorkspaceHost.applyWrite`. TrueForge is a separate process and holds model credentials; the extension never sees them.
- **Not used.** Skills, Code Mode and large-response offloading need TrueForge's sandbox, which is a cloud service. The brief requires local mode, so we do not use them (D-012).

## 4. How context is selected

Context assembly is what decides whether the agent works on a repository that is larger than any context window. Our strategy combines a push pack, built for every request, with pull tools that the agent can call.

- **Index.** The workspace walk honours `.gitignore` and default excludes, and skips binary files and files over 512 KB, and stops at 20,000 files. On pallets/flask 3.1.3 it indexes 226 files in 154 ms. Regular expressions extract symbols (Python, TS/JS, Go, Java, Rust, Ruby, C/C++ and Markdown/RST headings). Files are chunked at symbol boundaries, with 60-line windows as a fallback. The chunks go into an in-memory BM25 index (k1 = 1.2, b = 0.75) whose tokenizer splits camelCase and snake_case and drops stop-words. A file watcher updates it incrementally.
- **Push pack.** Each request gets a Context Pack with a budget of 12 000 tokens by default (`anvil.contextBudget`). The setting is clamped to 1,000–200,000. Tokens are estimated as characters divided by four.
  1. *Pins, up to 50 percent of the budget.* The selection, `@file` mentions (a whole file if it fits within 35 percent of the budget, otherwise its three best chunks), and `@symbol` mentions.
  2. *Repo map, reserved at 10 percent.* The directory tree and the top-level signatures of the focus files.
  3. *Ranked chunks fill the rest, with a 12% per-chunk cap.* Candidates come from BM25 (weight 1.0), symbol name matches (1.0), path matches (0.6), the active, open and recently edited files (0.5), and one-hop import neighbours of the top three files (0.4). They are combined with weighted Reciprocal Rank Fusion (k = 60). At most three chunks come from one file, and overlapping ranges are skipped.
  4. Candidates that do not fit are recorded as dropped, with the reason "over budget".
- **Reasons are visible.** Every item carries a reason, such as `pinned: @mention`, `bm25: "..."`, `symbol match: ...` or `imports/imported by ...`. The reasons appear in the Context Inspector card in the panel, and inside the `<anvil_context>` block sent in the TrueForge turn. Each item also carries a score and a token count, and item text is neutralised (`</item>` becomes `<\/item>`) so file content cannot break out of the wrapper. The session therefore records which files were chosen and why.
- **Pull tools.** `search_code`, `find_symbol`, `grep` and `repo_map` use the same index. `read_file` returns numbered windows of 250 lines by default, capped at 16 KB, so no single result floods the context. The agent is told the pack is a starting point, not the whole truth, and can pull more.
- **Why not embeddings.** Retrieval is deterministic, needs no external calls, and runs in milliseconds on a 17 000-line repository. Its weak point is paraphrased queries that share no identifiers with the code. Symbol and path signals reduce that weakness. The trade-off is recorded in D-008.
- **Check.** CI runs the Task B query against pallets/flask 3.1.3 and asserts that `src/flask/cli.py`, `tests/test_cli.py` and `docs/cli.rst` are in the pack, and that the pack stays within budget.

## 5. Model setup

Anvil works with whatever models TrueForge is configured with. Models are added in TrueForge, either through its UI or through `config/trueforge.example.json`, and are named in the `anvil.models` setting as `provider/model`. The example uses a Groq-hosted model as primary and a local Ollama model as fallback.

- **Model Relay.** A failed attempt is classified from its error. Transient failures (429, 5xx, timeouts and stalls) retry with backoff. Fatal model failures (401 or 403, unknown model, unreachable endpoint) switch to the next model at once. When TrueForge itself is down, the run stops with a clear message and the Doctor action. Before a retry or switch, the failed attempt's file writes are reverted, so the workspace is unchanged.
- **How a user switches models.** Edit `anvil.models` in VS Code settings. The new chain applies to the next run.

Models used for this submission:

| Model | Where it ran | Used for | Cost |
| --- | --- | --- | --- |
| `anvil-local/qwen` (local Qwen via Ollama, OpenAI-compatible) | Local machine, connected to VS Code through TrueForge | Demo Tasks A–C: inline edit, multi-file agent run, failure path | $0 |
| Scripted OpenAI-compatible mock (`test/e2e/mockLlm.ts`) | Real TrueForge on GitHub Actions | Six e2e scenarios: approved multi-step edit, deny, fallback, cancel, inline agent, all-broken | $0 |
| `broken/broken-model` (unreachable endpoint) | TrueForge on CI and Task C | Clean failure and fallback path; proves the workspace stays unchanged | $0 |
| Gemma 4 12B via Ollama (development QA) | Local RTX 5050 Laptop, 8 GB GPU | Task A and C passed; Task B ran the tool loop but 16k context was too small to finish | $0 |

**Switching models.** Edit `anvil.models` in VS Code settings. The new chain applies to the next run; when idle, Anvil starts a fresh chat so history is not carried across chains. Within a run, Model Relay retries transient failures and switches fatal ones with `sessions.update` on the same session. The example config pairs a hosted primary with a local Ollama fallback; the submission itself used local Qwen and CI mocks, so the marginal model cost is $0.

## 6. Scorecard

| Criterion | Video | Claim |
| --- | --- | --- |
| A1 Inline edit | 00:00:07–00:01:10 | Streamed inline diff; per-hunk accept/reject; 12 checks pass, including uppercase, empty and unset values. |
| A2 Agent mode | 00:01:26–00:03:11 | One prompt, no files named; the agent finds and edits `cli.py`, `test_cli.py` and `cli.rst`; 81 tests pass. |
| A3 Streaming + cancel | 00:00:08 / 00:00:39 | Streaming diff; a cancelled run reports "restored 0 file(s)"; live cancel aborts SSE and rolls back applied writes. |
| B1 Context assembly | 00:01:40 | Context Inspector shows the pack, token cost and "+38 candidates dropped (over budget)"; the agent's Context plan names the files. |
| B2 Diff safety | 00:00:39 / 00:01:10 | Per-hunk review before disk; Undo change / Revert run controls on the applied-changes timeline. |
| B3 Resilience | 00:03:46–00:03:52 | Broken local endpoint → clear ECONNREFUSED error, editor responsive, `git status` clean. |
| B4 TrueForge depth | 00:02:51 | 10 editor tools over MCP; approval drives review; session view shows tool calls and "Summarizing context" (compaction). |
| C1 Video | 00:00:00–00:04:00 | Tasks A, B and C in order, each verified on screen: `False`, 81 tests + masked JSON, clean tree. |
| C2 Write-up | This document | Architecture, context strategy, model setup, scorecard, trade-offs and limitations. |

Timestamps are from the 4:00 cut. A3's cancelled-run notice and B2's undo controls are visible; the live cancel/undo clicks and the automatic fallback are additionally covered by unit, integration and e2e tests. Task C's recorded path is the clear-error branch; fallback is e2e-tested (broken → mock) and visible in the panel's fallback notice.

## 7. Tools used

- **Claude Code**, with Claude Opus orchestrating Claude Sonnet and Haiku subagents, for planning, implementation and review.
- **Gemini through the Antigravity CLI**, for integration tests and independent code review.
- **OpenCode with Ollama (gemma4)**, for the per-file documentation.
- **GitHub Actions**, for CI and for building and publishing the release.

TrueForge runs the agent loop; the extension uses the TrueForge TypeScript SDK and the MCP TypeScript SDK. AI coding assistants cost no points; we declare them for completeness.

## 8. Known limitations and what we would do with another month

Limitations, as they stand at submission:

- **E2E proves wiring, not answer quality.** The real-TrueForge suite in CI uses a scripted mock model; quality with real models is shown in the demo, not in CI.
- **Symbols use regular expressions.** Unusual syntax can be missed, and end lines are a heuristic.
- **Retrieval is keyword-based.** There are no embeddings, so paraphrased queries are weak.
- **One bridge per machine.** The bridge uses the fixed port 7801. A second VS Code window reports that tools are served by the other window (inline edit still works).
- **Doctor checks model names, not model calls.** It confirms that each configured name exists in TrueForge, but does not query each model.
- **Token counts are estimates.** The budget uses characters divided by four.
- **CI runs on Linux only.** The VS Code smoke suite runs under xvfb.
- **Inline edit sees about 2,000 tokens and has no tools.**
- **The local Qwen run needed three corrections** (a missing `json` import, Flask default-value serialization, and the CLI test fixture), which is exactly what the review step is for.
- **The 4:00 cut does not perform a live cancel or undo click.** It shows the cancelled-run notice and the undo controls; both actions are covered by tests. Task C's recorded path is the clear-error branch; automatic fallback is e2e-tested and visible in the panel's fallback notice.

With another month, we would:

- Replace the regular expressions with a parser (tree-sitter), and add a symbol graph for references, so that `find_symbol` and the repo map are more precise.
- Add embeddings as a second retrieval signal, computed by a local model behind TrueForge.
- Finish the real-TrueForge end-to-end suite, with a scripted model that covers search, approval, cancel and fallback, and run it on every push.
- Allow more than one VS Code window to use the bridge, by giving each window its own port and registration.
- Run CI on macOS and Windows.
- Build an evaluation harness that runs Tasks A, B and C across several models and records the results, so that model choice can be compared on the same evidence.
- Show per-run token and cost metrics in the panel, using the metrics TrueForge already returns at the end of a turn.
