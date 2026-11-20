# Proposal: add-anvil-v1

## Why
The TrueFoundry Forge-a-thon requires an editor-native coding agent whose agent loop runs on TrueForge. It must
find the right code in a repository larger than a context window, make multi-file changes without being told
which files to change, show every change for review before disk, and survive model failures.

## What Changes
- Add the Anvil VS Code extension (from scratch, MIT).
- Add an MCP bridge inside the extension exposing editor capabilities as tools to TrueForge.
- Add TrueForge agent definitions `anvil-coder` (agent mode) and `anvil-inline` (inline edit).
- Add a Context Engine (index, BM25, symbols, budgeted Context Pack) with push and pull retrieval.
- Add per-hunk diff review driven by TrueForge tool approval, transactional runs, and an undo timeline.
- Add streaming rendering, immediate cancellation with rollback, and a client-side Model Relay (retry + fallback).
- Add setup tooling (register MCP bridge, providers and agents), a Doctor command, CI and a build workflow.

## Capabilities
- `inline-edit` — selection + instruction → streamed, reviewable replacement.
- `agent-mode` — panel-driven TrueForge tool loop across multiple files.
- `context-assembly` — mentions, pins, automatic retrieval within a budget, explainable.
- `diff-review` — hunk-level accept/reject, no silent writes, undoable.
- `streaming-cancellation` — token streaming, non-blocking UI, consistent cancel.
- `model-relay` — retry with backoff, automatic fallback, clear errors.
- `mcp-bridge` — secure local MCP server with editor tools.

## Out of scope
Tab completion or FIM, model hosting or fine-tuning, accounts or auth, hosted backends, Marketplace publishing,
TrueForge sandbox features (skills, Code Mode, large-response offloading), and embeddings-based retrieval.

## Impact
New repository. Requires a locally running TrueForge (`npx @truefoundry/trueforge@latest`) and at least
one model configured in it.
