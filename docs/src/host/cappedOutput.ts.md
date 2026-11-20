# `src/host/cappedOutput.ts`

**Purpose**
Output accumulator that keeps the first 16 KB and last 48 KB of a stream so long command output cannot exhaust memory. No `vscode` dependency (unit-tested).

**Exports**
- `CappedOutput`: `push(chunk)`, `toString()`.

**Collaborators**
- Imports: none.
- Used by: `commandRunner.ts`.

**Key behaviour and invariants**
- Limits are in string characters (16384 head, 49152 tail), not bytes.
- `push` fills the head first; the rest goes to the tail, which is trimmed to its last 48 K characters. The number of dropped characters is counted in `skipped`.
- `toString` returns head + tail, or, if anything was dropped, `head`, a line `... [N chars truncated] ...`, then `tail`.

**Notes**
- Anything up to 64 K characters is returned complete.
