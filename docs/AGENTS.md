# Guide for AI coding agents

This guide is for AI coding assistants (Claude Code, Gemini, OpenCode, Copilot and similar tools) that change this repository. Read it before you edit anything. [CONTRIBUTING.md](../CONTRIBUTING.md) covers the same ground for human contributors, and [CODEBASE.md](CODEBASE.md) explains where code lives.

## 1. Ground rules

1. **Spec first.** Behaviour changes start as an OpenSpec change under `openspec/changes/<name>/` (a proposal and the capability specs it touches). `openspec/changes/add-anvil-v1` is the current v1 change. Validate with `openspec validate`.
2. **Keep the docs in step with the code.** Every source file has a mirror doc at `docs/src/<same path>.md`, for example `src/core/diff/hunks.ts` maps to `docs/src/core/diff/hunks.ts.md`. When you touch a source file, create or update its mirror doc. If the docs and the code disagree, the code is right: fix the doc and say so in the PR.
3. **Record decisions.** Every design decision goes into [DECISIONS.md](DECISIONS.md) as a new entry (`D-0nn`). Append only. To change a decision, write a new entry that supersedes the old one and mark the old one as superseded. Do not rewrite history.
4. **Log major actions.** Add a dated entry to [LOG.md](LOG.md) for phase completions, notable merged PRs, and infrastructure changes.
5. **Follow the contracts.** [ARCHITECTURE.md](ARCHITECTURE.md) sections 7 and 8 define the module signatures. Implement them exactly. If a contract is wrong, change the contract doc in the same PR and explain why, rather than inventing a different API.
6. **Do not claim unverified behaviour.** Describe what the code does, not what the plan says it will do. Check TrueForge facts against [TF_DOCS.md](TF_DOCS.md), which was verified against TrueForge's source.

## 2. Invariants: never break these

1. **No direct model calls.** Only `src/trueforge/` talks to TrueForge, and only through the SDK. No code calls a model provider. Models are configured in TrueForge, and the extension names them in `anvil.models`.
2. **No writes without review.** Every file write made on behalf of the agent goes through the review and the approval ledger. An inline edit writes only after the user accepts hunks. `RunController.isRunActive()` must be true for any MCP write, and `gatedWrite` must check it. Do not add an MCP tool that writes to disk directly.
3. **`src/core` does not import `vscode`.** ESLint enforces this. Keep `core` testable as plain Node code.
4. **Ledger arguments are untouched.** The ledger key is `canonicalKey(tool, args)`, a hash of the arguments that TrueForge approved. MCP tool handlers must pass the arguments exactly as received. Do not add zod defaults, do not rewrite paths in the arguments, and do not reorder fields. The comment at the top of `gatedWrite` in `src/mcp/tools.ts` explains why.
5. **The budget is never exceeded.** `assembleContext` must return `used <= budget`. The retrieval integration test asserts it.
6. **Secrets stay out of git.** No keys in any tracked file. `config/trueforge.local.json` and `.env*` are gitignored (`.env.example` is the exception). The bridge token is stored in SecretStorage, and API keys come from the environment.
7. **The bridge stays local.** It binds `127.0.0.1` and requires the bearer token, compared in constant time. Keep the Origin check and the 1 MB body limit.
8. **Paths stay in the workspace.** Every path that comes from the model goes through `resolveInWorkspace`. It rejects `..`, absolute paths outside the root, and NUL bytes.
9. **Cancel leaves no half-applied edits.** When `anvil.cancelBehavior` is `revert`, a cancelled run is reverted. Writes that arrive after the run ends are refused.

## 3. Commands to run before committing

```bash
npm run typecheck
npm run lint
npm run format:check      # run `npm run format` to fix
npm run build
npm test
```

Also run `npm run test:vscode` (on Linux, `xvfb-run -a npm run test:vscode`) when you change activation, commands, views or settings. Run `npm run package` when you change contributions in `package.json`. CI runs the same checks on every push.

`npm run format:check` covers `README.md` and `CONTRIBUTING.md`. It does not cover `docs/`, which Prettier ignores.

## 4. Commits, branches and pull requests

- Work on a feature branch from `main`. Do not commit to `main` directly.
- Use Conventional Commits, for example `feat(core): ...`, `fix(host): ...`, `test(context): ...` or `docs: ...`. Keep commits small, with one logical change each.
- Commits in this repository are unsigned, so `git -c commit.gpgsign=false commit` is the expected form.
- Open a pull request into `main`. Merge only when the `CI passed` check (job `ci-ok`) is green. The check is green only when both the quality phase and the integration phase pass.
- Merge pull requests with `gh pr merge`.
- Changes under `.github/workflows/` are the exception to the merge rule. The GitHub token used by `gh` lacks the `workflow` scope, so push the branch and merge it locally into `main` with git, then push `main`.
- In the PR description, say what changed, why, and how you verified it. Link the OpenSpec change or the DECISIONS entry where one exists.

## 5. Where things live

| Concern | Location |
| --- | --- |
| Activation, wiring, commands | `src/extension.ts` |
| Agent definitions | `agent/anvil-coder.json`, `agent/anvil-inline.json` |
| TrueForge client, sessions, approvals, cancel | `src/trueforge/client.ts`, `session.ts` |
| Registration of the bridge and agents | `src/trueforge/setup.ts`, `scripts/setup-trueforge.mjs` |
| Spec loading and SDK camelCase conversion | `src/trueforge/spec.ts` |
| Model Relay and failure classes | `src/core/agent/fallback.ts` |
| Event folding into a view | `src/core/agent/events.ts`, `toolCalls.ts` |
| Context engine | `src/core/context/` (`codeIndex.ts`, `rank.ts`, `assemble.ts`, `bm25.ts`, `symbols.ts`) |
| Search/replace edits and whole-file writes | `src/core/edits/applyEdit.ts` |
| Hunks | `src/core/diff/hunks.ts`, `src/host/reviewModel.ts` |
| Review UI (diff tabs, CodeLens) | `src/host/reviewController.ts` |
| Approvals and the ledger | `src/host/approvalFlow.ts`, `src/core/ledger.ts` |
| Checkpoints, undo, revert | `src/core/transaction.ts`, `src/host/fileStore.ts`, `src/host/runController.ts` |
| Inline edit | `src/host/inlineEdit.ts`, `src/core/inline/prompt.ts` |
| MCP bridge and tools | `src/mcp/server.ts`, `tools.ts`, `auth.ts` |
| Panel protocol and webview | `src/panel/protocol.ts`, `src/panel/panelProvider.ts`, `webview/` |
| Settings | `package.json` (contributions), `src/core/config.ts`, `src/host/config.ts` |
| Doctor | `src/host/doctor.ts` |
| Tests | `test/unit`, `test/integration`, `test/e2e`, `test/vscode` |
| CI and releases | `.github/workflows/ci.yml`, `build.yml` |
| Demo tooling | `scripts/demo/setup-flask.sh`, `scripts/demo/reset-flask.sh` |

## 6. Working on the demo tasks

The three fixed demo tasks run against pallets/flask at tag `3.1.3`. Prepare the checkout with `scripts/demo/setup-flask.sh` and reset it between takes with `scripts/demo/reset-flask.sh -y`. The task wording and the verification commands are in the README. Do not change the wording of a task to make it easier to pass. If a change would alter a task's behaviour, record it in DECISIONS.md.

## 7. Known gaps to keep in mind

The README's "Known limitations" section is the list the team publishes. Read it before you claim a feature works. In particular:

- The real-TrueForge e2e suite (test/e2e) runs on every push in CI with a scripted model; keep it green.
- Doctor checks that model names exist in TrueForge. It does not call the models.
- Symbol extraction uses regular expressions, not a parser.
