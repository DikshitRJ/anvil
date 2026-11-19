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
