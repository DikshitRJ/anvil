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
