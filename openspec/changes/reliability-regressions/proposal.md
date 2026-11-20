# Improve command and retrieval reliability

## Why
Commands decode individual byte chunks, which corrupts split UTF-8 sequences. Retrieval boundary cases and index lifecycle operations need dedicated regression coverage.

## What Changes
- Decode stdout and stderr independently across chunk boundaries and settle command completion once.
- Correct retrieval limits, exact-fit context windows, class gap coverage, and source import resolution as covered by focused regressions.
- Extend deterministic tests across command lifecycle, indexing, editing, and rendering contracts.

## Impact
- Affected specs: agent-mode, context-assembly.
- No model calls or new runtime dependencies.
