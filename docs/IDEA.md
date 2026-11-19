# Anvil — Product Idea

> *A forge needs an anvil.* Anvil is an editor-native coding agent for VS Code whose agent loop runs on
> TrueForge. TrueForge is the furnace (loop, streaming, sessions, approvals). Anvil is where the metal gets
> shaped: what the model sees, and how safely its changes land in your editor.

## 1. The problem, restated

The challenge question asks for an agent that:

1. finds the right code in a repo bigger than any context window,
2. makes a multi-file change the user never spelled out file by file,
3. shows every change for review before it touches disk,
4. keeps working when the model behind it fails.

The objective also lists three pain points every engineer has with AI coding tools. Anvil treats each one as a
feature requirement:

| Pain point (from the brief) | Anvil feature that answers it |
| --- | --- |
| "loses track of the file you care about" | **Focus Pins**: `@file`/`@symbol` mentions, the active selection and open editors are pinned at the top of the context budget and never evicted. |
| "rewrites a function you did not ask it to touch" | **Scope Lock**: an inline edit can only replace the selected range. Agent edits are reviewed hunk by hunk, so nothing outside an accepted hunk changes. |
| "confidently edits a symbol that does not exist" | **Symbol Grounding**: `edit_file` is search/replace and fails unless `old_string` matches exactly once. `find_symbol` resolves a symbol before it is edited. Failures go back to the model as actionable errors, not silent no-ops. |

## 2. Mandatory capabilities, and how Anvil builds each one

| # | Capability | Anvil implementation |
| --- | --- | --- |
| 1 | **Inline edit** | Select code → `Ctrl+Alt+E` → type an instruction. A dedicated `anvil-inline` TrueForge agent streams the replacement, and a **live diff** (native diff editor) updates as tokens arrive. Per-hunk **Accept / Reject** CodeLens, plus Accept all / Reject all. |
| 2 | **Agent mode** | Sidebar panel → one request → the `anvil-coder` TrueForge agent loops over Anvil's MCP tools (`search_code`, `read_file`, `find_symbol`, `repo_map`, `grep`, `list_files`, `get_diagnostics`, `edit_file`, `write_file`, `run_command`) until done or iteration limit. It finds the files itself. |
| 3 | **Context assembly** | Hybrid **push + pull**. *Push*: the Anvil Context Engine builds a budgeted **Context Pack** (pins, then retrieved chunks, then a repo-map skeleton) with a stated reason per item. *Pull*: the same engine is exposed as MCP search tools. TrueForge **subagents**, **deferred tool loading** and **compaction** keep the root context lean. |
| 4 | **Diff review** | Every write tool is approval-gated **in TrueForge**. `tool.approval_required` opens Anvil's hunk-by-hunk review. Your decision goes back as `user.tool_approval`, and the MCP tool then applies **only the accepted hunks**. Undo by change, by run, or with native `Ctrl+Z`. |
| 5 | **Streaming and cancellation** | Tokens render from `model.message.delta`. **Stop** (or `Esc`) aborts the stream, calls `sessions.cancel`, kills running commands, discards pending reviews, and **rolls back the run transaction**, so a cancelled run leaves the workspace exactly as it was before. |

## 3. The extras on top

### 3.1 Context Inspector (explainable retrieval)
Each agent request shows a collapsible card listing every file or chunk Anvil put into context: **why** it
was chosen (`pinned: @mention`, `bm25: "cli command" 7.9`, `symbol match: FlaskGroup`, `import neighbour of
cli.py`, `open editor`), its token cost, and a **budget bar** (e.g. `9.3k / 12k tokens`). The same manifest
goes into the TrueForge turn, so the session itself records which files were chosen and why.
The agent is also told to open with a short *Context plan*.

### 3.2 Model Relay (resilience you can see)
An ordered chain of models (`anvil.models`). Each failure is classified:

* **transient** (network, 429, 5xx, stall timeout): retry with exponential backoff (0.5 s, 1.5 s);
* **fatal for this model** (401/403 bad key, 404 unknown model, unreachable endpoint): skip to the next model.

The relay switches models **inside the same TrueForge session** (`sessions.update` on the inline spec), so
history is kept and the session shows both attempts. A status-bar item shows the active model, and a toast
explains each switch ("primary failed: 401 invalid key → continuing on `ollama/qwen2.5-coder`"). If the whole
chain fails: one clear message, a workspace untouched by the failed attempts, and a **Doctor** button.

### 3.3 Transactional runs and the Checkpoint Timeline
Every agent run is a transaction: Anvil snapshots each file before its first accepted write.

* **Cancel**: the run reverts automatically (configurable: `anvil.cancelBehavior = revert | keep`).
* **Fallback after partial writes**: the failed attempt is reverted before the next model starts.
* **Timeline**: the panel lists applied changes with *Undo change* and *Revert run* buttons. Conflicts (the
  file changed since) are detected and confirmed before anything is restored.

### 3.4 No-Silent-Write Invariant (defence in depth)
Approval is enforced in two places. TrueForge gates the call. Then Anvil's MCP server refuses to write
anything that does not match a decision recorded in its **Approval Ledger** (keyed by a canonical hash of the
tool arguments). If an approval ever bypasses the UI (for example a session-wide policy), the MCP tool opens
the review itself and blocks until you decide. Nothing reaches disk unreviewed.

### 3.5 Editor-native signals the CLI agents don't have
* `get_diagnostics`: language-server errors and warnings for files the agent touched, so it can self-correct.
* Open editors, cursor and selection feed the pins automatically.
* `@` autocomplete for files and symbols, served from the live index.

### 3.6 Secure local bridge
The MCP server binds to `127.0.0.1` only, requires a random bearer token (kept in VS Code SecretStorage and
registered in TrueForge as header auth), confines every path to the workspace (no `..`, no symlink escapes),
and runs commands only after approval, with a timeout, output caps and kill-on-cancel.

### 3.7 One-command setup and Doctor
`Anvil: Set up TrueForge` (or `npm run setup:trueforge`) registers the MCP bridge, the model providers from
`config/trueforge.local.json`, and both agent definitions. `Anvil: Doctor` checks the TrueForge reachability,
MCP registration, the bridge round-trip, each model in the chain and the index status, then reports what to fix.

## 4. Fairness by design (any model works)
Judges may swap the model. Anvil avoids depending on a strong model:

* inline edit needs **no tool calling**: it asks for one fenced code block and tolerates missing fences;
* `edit_file` uses search/replace (easy for small models), and `write_file` is the fallback;
* the push Context Pack means even a model that never calls `search_code` sees the right files;
* tool results are compact (line-numbered windows, capped sizes), so small context windows survive.

## 5. Out of scope (deliberately)
Tab completion or FIM, model hosting or training, accounts, a hosted backend, Marketplace publishing,
Daytona sandbox, skills and Code Mode (these need a cloud sandbox; see DECISIONS.md D-012).

## 6. Demo storyboard (maps to the three fixed tasks)
* **A**: `helpers.py` → select `get_debug_flag` → Ctrl+Alt+E → the instruction → the live diff streams →
  accept per hunk → terminal check prints `False`.
* **B**: Agent panel → the instruction → the Context Inspector shows `cli.py`, `test_cli.py`, `docs/cli.rst`
  with reasons → tool cards stream → three or more review tabs, hunk by hunk → accept → `pytest tests/test_cli.py -q`
  passes → `flask config` prints masked JSON → open the TrueForge session (turns, tool calls, subagent thread).
* **C**: the chain is `[broken/invalid-key-model, working-model]` → repeat A → toast "falling back" → the diff
  arrives from the second model → `git status` is clean before accept. Variant: a chain of only broken models
  gives a clear error, a responsive editor and a clean `git status`.
