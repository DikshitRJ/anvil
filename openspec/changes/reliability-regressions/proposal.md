# Improve command, session, and retrieval reliability

## Why
Stream decoding, session lifecycle, and incremental retrieval have reproducible edge cases that corrupt output, run the wrong model, retain stale context, or cause false restore conflicts.

## What Changes
- Preserve split UTF-8 output and finalize commands once.
- Reset compaction state, verify model synchronization, and honor cancellation during startup.
- Fix retrieval limits, exact-fit windows, class gaps, and emitted TypeScript import resolution.
- Add multiline Python import neighbours, quoted file mentions with autocomplete, and extended Markdown fences.
- Evict ineligible indexed files, stop disposed health callbacks, isolate queued transcript identities, and refresh changed tool previews.
- Synchronize undo base snapshots and serialize concurrent checkpoint restores.
- Add deterministic regression coverage for the changes and existing edit/retrieval contracts.

## Impact
- Affected specs: agent-mode, context-assembly.
- No model-provider calls, runtime dependencies, or release tags are added.
