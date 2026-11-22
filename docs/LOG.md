# Anvil — Work Log

Chronological log of major actions, phase outcomes and notable events. Times are IST.

## 2026-11-20

### Phase 0 — Study and plan (Opus)
- Read the problem statement (`docs/problem/PROBLEM_STATEMENT.pdf`): five mandatory capabilities, three fixed tasks
  on pallets/flask 3.1.3, a TrueForge eligibility gate, a 100-point rubric.
- Created the private GitHub repo `DikshitRJ/anvil`, with an initial commit (license, gitignore) and the problem statement.
- Cloned `truefoundry/trueforge@0a7ae41` into a scratch dir. Read the docs and verified against server and SDK source:
  the settings API for MCP and model registration, inline-spec session updates (the basis of model fallback), the
  deferred `call_tool` argument shape, the pause/resume protocol, and the fact that the LLM adapter has `maxRetries: 0`
  with no built-in fallback.
- Attempted to start TrueForge locally (`npx @truefoundry/trueforge@latest`). **Blocked by the session's auto-mode
  permission classifier.** Decision: real-TrueForge verification moves to CI (DECISIONS D-019).
- Wrote `docs/TF_DOCS.md`, `docs/IDEA.md`, `docs/ARCHITECTURE.md` (with authoritative module contracts),
  `docs/DECISIONS.md` (D-001…D-019) and `docs/PLAN.md`.
- `openspec init`. Change `add-anvil-v1` with 7 capability specs (inline-edit, agent-mode, context-assembly,
  diff-review, streaming-cancellation, model-relay, mcp-bridge); `openspec validate` passes.
- Persisted architecture facts in MemPalace (wing `anvil`).

### Phase 1 — Scaffold (Sonnet, PR #2)
- Toolchain (esbuild, strict TS, eslint flat config with a `vscode` import ban in `src/core`, prettier, vitest), every
  module contract from ARCHITECTURE §7 stubbed, agent definitions, example model config, `contributes`. 11 commits.

### Phase 2 — Parallel core (5 Sonnet + 1 Haiku workstreams, all in worktrees)
- #1 CI (Haiku): two-phase workflow + `ci-ok` gate; setup and demo scripts.
- #13 core safety: hunks, edit simulation, ledger, path guard, checkpoints, inline prompt (61 tests).
- #17 context engine: walker, symbols, chunker, BM25, CodeIndex, RRF assembly. Verified by Opus on real
  pallets/flask 3.1.3: 226 files indexed in 154 ms; Task B pack contains cli.py, test_cli.py, docs/cli.rst.
- #19 TrueForge runner: verified SDK wire format (SSE `id/data`, early header flush, no `title` on create,
  snake_case manifests → `toSdkSpec`), pause/resume, cancel < 200 ms, Model Relay. 41 tests against a mock server.
- #12 MCP bridge: 10 tools, bearer + Origin checks, stateless Streamable HTTP, args passed untouched to the gate.
- #14 webview panel: reducer, safe markdown, Context Inspector, approvals, timeline, @ autocomplete.
- Housekeeping: dependabot majors closed and pinned (#18); gh token lacks `workflow` scope → workflow PRs are merged
  locally and pushed over SSH (#16).

### Phase 3 — Integration (2 Sonnet)
- #20 review controller (diff editor + per-hunk CodeLens, queue, live streaming) and inline edit.
- #21 run controller, workspace host (symlink guard), index service, Doctor, status bar, composition root.
  CI's VS Code smoke suite caught a real hang (`anvil.cancel` awaited a toast); fixed by Opus, suite now opens the
  mini-flask fixture and checks bridge auth.
- Release workflow changed per user request: builds only on `v*` tags on main and attaches the vsix (#16).
  `v0.1.0` released.

### Local QA of v0.1.0 (Opus, user-requested)
- Downloaded the release vsix, installed it into an isolated VS Code profile (`--user-data-dir/--extensions-dir`),
  opened Flask 3.1.3, drove the UI over the Chrome DevTools Protocol. Verified activation, panel, Context Inspector,
  bridge auth (401/403/405/404), Doctor, and the TrueForge-down path (clear errors, editor responsive, `git status`
  clean). Starting TrueForge locally was denied twice by the permission classifier — not worked around.

### Phase 4 — Real-TrueForge e2e (PR #30, CI only)
- Scripted OpenAI-compatible mock LLM + real `npx @truefoundry/trueforge` in GitHub Actions. Six scenarios pass:
  approved multi-step edit, deny, fallback broken→mock, cancel, inline agent, all-broken. Findings: TrueForge's
  outbound URL policy blocks loopback unless `OUTBOUND_URL_ALLOWED_HOSTS` is set (#41); `ensureSetup` sent the
  placeholder model (#40).

### Phase 5 — Documentation
- #34 per-file mirror `docs/src/**` (OpenCode + Ollama gemma4:12b; spot-checked by Opus).
- #43 README, CONTRIBUTING, CODEBASE, AGENTS, WRITEUP draft (Haiku; reviewed and corrected by Opus).

### Phase 6 — Review and issues
- Independent reviews: Claude `code-reviewer` (24 findings) and Gemini via Antigravity (22 verified, ~12 agy claims
  dropped as wrong). Triaged into issues #22–#29, #31–#33, #40, #41, #44–#46.
- Fixed and merged: #35 (stall busy-awareness, relay lifecycle), #36 (inline/review lifecycle), #37 (multi-window
  bridge, edge cases), #39 (ranking priors, grep budget, safe delimiter, real-module MCP tests), #42 (run-scoped
  approvals, cancellation guards, error handling, isBusy wiring; rebased replacement for #38 since force-push was
  denied).

### Phase 6 (cont.) — e2e findings and second review round
- e2e found and we fixed: placeholder model at agent registration (#40 → #48, e2e agent-registration test
  un-skipped and green) and the TrueForge loopback allowlist requirement (#41 → README, setup script, Doctor hints).
- Gemini findings fixed: per-line EOL preservation and EOL-only hunks (#44 → #50); revert on error, tab-close cancels
  review, dismissed questions, eviction-proof per-run base snapshots (#45 → #49); ledger TTL on take, full-path
  listFiles globs, resubscribe counter (#46 → #49).

### Phase 7 — Releases and final QA
- `v0.1.1` (all review fixes) and `v0.1.2` released from tags; each run attached `anvil-<tag>.vsix`.
- Local QA of each release (downloaded from GitHub Releases, isolated VS Code profile, driven over CDP) found:
  error text missing the URL (fixed in v0.1.1), path-match noise from common tokens (#51 → #53), and a retry refused
  while an error toast was open because the handler awaited the toast (#52). Verified fixed in v0.1.2.
- Per-file docs mirror refreshed to 55 pages (#54). OpenSpec change `add-anvil-v1` archived; 7 capability specs
  now live in `openspec/specs/`.
- Final state: 0 open issues; main CI green (lint, types, format, package; 257 unit/integration tests; real-TrueForge
  e2e; VS Code smoke suite).

### Live QA against a real TrueForge (user-started, 2026-11-20)
- The user started TrueForge locally (the classifier had blocked the agent from doing so). First start failed:
  zsh exports `HOST=<hostname>`, which TrueForge uses as its bind address → documented `HOST=localhost` (#61).
- `npm run setup:trueforge` failed every registration (snake_case vs the SDK's camelCase; un-awaited
  `agents.list()`) → fixed and verified live (#62).
- Model: local Ollama `gemma4:12b` (8 GB GPU). Results, all in an isolated VS Code profile with the released vsix:
  - **Task A — pass.** Live streaming diff, per-hunk accept, `FLASK_DEBUG=off … print(get_debug_flag())` → `False`;
    Undo Last Applied Change restored the file (`git status` clean).
  - **Task C — pass.** Chain `[broken/broken-model, ollama/gemma4-12b]`: automatic fallback toast, diff from the
    second model, Reject all → `git status` clean. All-broken chain: one clear error + Open Doctor, clean tree.
  - **Task B — tool loop works, model too small to finish.** Context plan named cli.py, test_cli.py, docs/cli.rst;
    the agent used Anvil's MCP tools via deferred `call_tool`, compaction ran, cancel worked. A 12B model at 16k
    context kept re-reading cli.py after each compaction and never proposed edits. Use a stronger model for Task B.
- Bugs found and fixed from this round: review CodeLens invisible by default (`diffEditor.codeLens` off → shipped
  as a configuration default plus Alt+Y/Alt+N and title buttons, #58); inline fallback didn't update the status bar
  (#59); Ollama silently truncating prompts to its default `num_ctx` → truncation warning + README guidance (#60);
  `run_command` ignored `anvil.commandTimeoutSec` (#61); fixed 60k compaction trigger never fired on small models
  → TrueForge's context-relative default, 250-line reads (#64, D-025); stall watchdog fired during compaction →
  paused while compacting, 120 s default (#65); Stop button disabled during runs (#66); stale summary lens (#67).
- Releases: v0.1.3, v0.1.4, v0.1.5 (each verified locally from GitHub Releases).


## 2026-11-22 — Reliability and retrieval improvements
- Fixed command UTF-8 decoding and duplicate completion, stale compaction state, model synchronization failures, and late turn creation after cancellation.
- Fixed stale index eligibility, queue identity collisions, disposed health callbacks, and undo/base-snapshot and concurrent-restore failures.
- Added multiline Python import neighbours, quoted file mentions, and tilde/variable-length transcript code fences.
- Corrected retrieval result limits, exact-fit windows, TypeScript source import resolution, and class-body chunk coverage.
- Added deterministic regressions alongside the fixes and expanded edit, retrieval, and review contract coverage.
- Specification: `openspec/changes/reliability-regressions`; decisions D-026 through D-047.
- File autocomplete now inserts escaped quoted mentions; tool cards refresh when same-length result text changes.

## 2026-11-22 — Live demo setup compatibility
Installed Anvil in VS Code and connected the local TrueForge MCP bridge. Found baseline Flask CLI collection failure with pytest 9.2.0. Pinning pytest 9.0.2 and installing dotenv restored all 58 baseline CLI tests on Python 3.14. Live tasks A/B/C remain unverified at this stage.
