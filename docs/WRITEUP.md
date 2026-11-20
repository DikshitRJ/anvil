# Anvil: write-up (draft)

Repository: https://github.com/DikshitRJ/anvil (MIT). Demo video: TODO (link, unlisted or "anyone with the link").

## 1. Team

- TODO: member 1 name, college or employer, GitHub handle
- TODO: member 2 name, college or employer, GitHub handle
- TODO: add up to three more members, or delete unused lines
- TODO: team name (used in the social media hashtag)

## 2. Starting point

From scratch. There is no upstream repository and no fork commit. Anvil is released under the MIT License. We borrowed ideas and not code: diff-review UX from Continue, tool cards from Cline, and search/replace editing from Claude Code. The agent loop is TrueForge, and the extension never runs a loop of its own. The rationale is in `docs/DECISIONS.md` (D-001).

## 3. Architecture on TrueForge

Anvil is a TrueForge client and an MCP server. It has no model code.

- **Client.** The extension uses `@truefoundry/trueforge-sdk` to create sessions with an inline agent spec: `anvil-coder` for agent mode and `anvil-inline` for inline edit. It sends turns, streams `model.message.delta` events into the panel and the diff, answers approval pauses, cancels turns, and switches model with `sessions.update` on the same session. It never calls a model provider.
- **Editor as MCP tools.** The extension runs a stateless Streamable HTTP MCP server on 127.0.0.1, guarded by a bearer token and an Origin check. TrueForge connects to it as the registered remote server `anvil-editor`. The server exposes ten tools:
  - Read-only, no approval: `read_file`, `list_files`, `search_code`, `grep`, `find_symbol`, `repo_map`, `get_diagnostics`.
  - Gated by approval: `edit_file`, `write_file`, `run_command`. These are listed in `require_approval_for_tools`.
- **Approval drives the review.** When the agent calls `edit_file`, `write_file` or `run_command`, TrueForge pauses the turn with `tool.approval_required`. For an edit, Anvil simulates the change, opens the per-hunk review, and answers `user.tool_approval` with allow (if at least one hunk was accepted) or deny (with the rejected hunks as the reason). The MCP handler applies only the accepted content. It checks the approval ledger again. If no recorded decision matches the call, it opens the review itself and blocks until the user decides, so an approval that bypasses the UI still cannot write unreviewed content.
- **Harness features used, and why:**
  - *Tool approval* makes the review the single path to disk.
  - *Deferred tool loading.* Four core tools are preloaded (`search_code`, `read_file`, `edit_file`, `write_file`). The rest are discovered on demand, which keeps the root context small.
  - *Dynamic subagents.* The coder may delegate broad reconnaissance, such as how CLI commands are registered and tested, to a subagent that returns only a summary. Approvals from a subagent are routed by thread id.
  - *Compaction.* Older history is summarised when input reaches 60 000 tokens, so long sessions survive.
  - *sessions.update for fallback.* When the Model Relay switches model, it updates the same session's spec. History is kept, and the session shows both attempts.
- **Not used.** Skills, Code Mode and large-response offloading need TrueForge's sandbox, which is a cloud service. The brief requires local mode, so we do not use them (D-012).

## 4. How context is selected

Context assembly is what decides whether the agent works on a repository that is larger than any context window. Our strategy combines a push pack, built for every request, with pull tools that the agent can call.

- **Index.** The workspace walk honours `.gitignore` and default excludes, and skips binary files and files over 512 KB. Regular expressions extract symbols. Files are chunked at symbol boundaries, with 60-line windows as a fallback. The chunks go into an in-memory BM25 index that splits identifiers in camelCase and snake_case. A file watcher updates it incrementally.
- **Push pack.** Each request gets a Context Pack with a budget of 12 000 tokens by default (`anvil.contextBudget`). Tokens are estimated as characters divided by four.
  1. *Pins, up to 50 percent of the budget.* The selection, `@file` mentions (a whole file if it fits within 35 percent of the budget, otherwise its three best chunks), and `@symbol` mentions.
  2. *Repo map, reserved at 10 percent.* The directory tree and the top-level signatures of the focus files.
  3. *Ranked chunks fill the rest.* Candidates come from BM25 (weight 1.0), symbol name matches (1.0), path matches (0.6), the active, open and recently edited files (0.5), and one-hop import neighbours of the top three files (0.4). They are combined with weighted Reciprocal Rank Fusion (k = 60). At most three chunks come from one file, and overlapping ranges are skipped.
  4. Candidates that do not fit are recorded as dropped, with the reason "over budget".
- **Reasons are visible.** Every item carries a reason, such as `pinned: @mention`, `bm25: "..."`, `symbol match: ...` or `imports/imported by ...`. The reasons appear in the Context Inspector card in the panel, and inside the `<anvil_context>` block sent in the TrueForge turn. The session therefore records which files were chosen and why.
- **Pull tools.** `search_code`, `find_symbol`, `grep` and `repo_map` use the same index. `read_file` returns numbered windows of 400 lines by default, capped at 24 KB, so no single result floods the context.
- **Why not embeddings.** Retrieval is deterministic, needs no external calls, and runs in milliseconds on a 17 000-line repository. Its weak point is paraphrased queries that share no identifiers with the code. Symbol and path signals reduce that weakness. The trade-off is recorded in D-008.
- **Check.** CI runs the Task B query against pallets/flask 3.1.3 and asserts that `src/flask/cli.py`, `tests/test_cli.py` and `docs/cli.rst` are in the pack, and that the pack stays within budget.

## 5. Model setup

Anvil works with whatever models TrueForge is configured with. Models are added in TrueForge, either through its UI or through `config/trueforge.example.json`, and are named in the `anvil.models` setting as `provider/model`. The example uses a Groq-hosted model as primary and a local Ollama model as fallback.

- **Model Relay.** A failed attempt is classified from its error. Transient failures (429, 5xx, timeouts and stalls) retry with backoff. Fatal model failures (401 or 403, unknown model, unreachable endpoint) switch to the next model at once. When TrueForge itself is down, the run stops with a clear message and the Doctor action. Before a retry or switch, the failed attempt's file writes are reverted, so the workspace is unchanged.
- **How a user switches models.** Edit `anvil.models` in VS Code settings. The new chain applies to the next run.

Models used for this submission:

| Model | Provider and where it ran | Used for | Approx. cost |
| --- | --- | --- | --- |
| TODO | TODO (for example, a hosted API or local Ollama) | TODO | TODO |
| TODO | TODO | TODO | TODO |

## 6. Scorecard

The timestamps are to be filled in from the final video.

| Criterion | Video timestamp | Claim |
| --- | --- | --- |
| A1 Inline edit | TODO | A streamed inline diff, with per-hunk accept and reject |
| A2 Agent mode | TODO | The agent finds and edits three or more files without being named |
| A3 Streaming and cancellation | TODO | Stop or Esc halts the run at once and reverts its applied changes |
| B1 Context assembly | TODO | Budgeted, explainable context (12k default), with reasons in the Context Inspector and the TrueForge turn |
| B2 Diff safety | TODO | Nothing is written before review, and an undo timeline reverts applied changes |
| B3 Resilience (Task C) | TODO | The model chain falls back within the same session, and the workspace stays unchanged |
| B4 TrueForge integration depth | TODO | Editor tools are MCP tools, approval drives the review, and deferred tools, subagents and compaction are used |
| C1 Video | TODO | Tasks A, B and C appear in order, each with its on-screen verification |
| C2 Write-up | TODO | Architecture, context strategy, model setup, trade-offs and limitations are all stated |

## 7. Tools used

- **Claude Code**, with Claude Opus orchestrating Claude Sonnet and Haiku subagents, for planning, implementation and review.
- **Gemini through the Antigravity CLI**, for integration tests and independent code review.
- **OpenCode with Ollama (gemma4)**, for the per-file documentation.
- **GitHub Actions**, for CI and for building and publishing the release.

## 8. Known limitations and what we would do with another month

Limitations, as they stand at submission:

- **E2E proves wiring, not answer quality.** The real-TrueForge suite in CI uses a scripted mock model; quality with real models is shown in the demo, not in CI.
- **Symbols use regular expressions.** Unusual syntax can be missed, and end lines are a heuristic.
- **Retrieval is keyword-based.** There are no embeddings, so paraphrased queries are weak.
- **One bridge per machine.** The bridge uses a fixed port. A second VS Code window on the same port fails with a clear error.
- **Doctor checks model names, not model calls.** It confirms that each configured name exists in TrueForge, but does not query each model.
- **Token counts are estimates.** The budget uses characters divided by four.
- **CI runs on Linux only.**

With another month, we would:

- Replace the regular expressions with a parser (tree-sitter), and add a symbol graph for references, so that `find_symbol` and the repo map are more precise.
- Add embeddings as a second retrieval signal, computed by a local model behind TrueForge.
- Finish the real-TrueForge end-to-end suite, with a scripted model that covers search, approval, cancel and fallback, and run it on every push.
- Allow more than one VS Code window to use the bridge, by giving each window its own port and registration.
- Run CI on macOS and Windows.
- Build an evaluation harness that runs Tasks A, B and C across several models and records the results, so that model choice can be compared on the same evidence.
- Show per-run token and cost metrics in the panel, using the metrics TrueForge already returns at the end of a turn.
