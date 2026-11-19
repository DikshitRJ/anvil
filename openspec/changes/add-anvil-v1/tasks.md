# Tasks: add-anvil-v1

Detailed scope per task lives in docs/PLAN.md. Each task lands as one or more PRs.

## 1. Scaffold
- [ ] 1.1 Package, toolchain, contract stubs, agent definitions, example config (`feat/scaffold`; test: smoke.test.ts)

## 2. Core modules
- [ ] 2.1 Diff hunks, edit simulation, ledger, path guard, checkpoints, inline prompt (`feat/core-safety`; test/unit/*)
- [ ] 2.2 Context Engine: tokenizer, symbols, chunker, BM25, walker, CodeIndex, mentions, assembler (`feat/context-engine`; test/unit + test/integration/retrieval)
- [ ] 2.3 Event reducer, tool-call resolver, Model Relay, TrueForge client/spec/setup/AnvilSession (`feat/trueforge-runner`; test/integration/session)
- [ ] 2.4 MCP bridge server, tools, auth (`feat/mcp-bridge`; test/integration/mcp)
- [ ] 2.5 Webview panel UI and provider (`feat/webview-panel`; test/unit/markdown, render)
- [ ] 2.6 CI, build workflow, setup and demo scripts (`ci/workflows`)

## 3. Integration
- [ ] 3.1 VS Code host adapters, review controller, inline edit, run controller, doctor, wiring (`feat/host-integration`; test/vscode)

## 4. Verification
- [ ] 4.1 Real-TrueForge e2e with mock LLM: tool loop, approval write, cancel, fallback (`test/e2e-trueforge`)

## 5. Documentation
- [ ] 5.1 Per-file docs mirror, CODEBASE, AGENTS, CONTRIBUTING, FLOW, README, WRITEUP

## 6. Review
- [ ] 6.1 Independent review → GitHub issues → fixes
