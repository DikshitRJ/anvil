# `src/core/ledger.ts`

**Purpose**
Approval ledger. Remembers the outcome of a diff review so the follow-up tool call can consume it exactly once.

**Exports**
- `stableStringify(value)`: deterministic JSON-like string.
- `canonicalKey(tool, args)`: sha256 hex of `${tool}\n${stableStringify(args)}`.
- `LedgerEntry`: `finalContent` (string or null), `totalHunks`, `feedback`, and optional deprecated, unused `acceptedHunks`.
- `ApprovalLedger`: `put`, `take`, `clear`, `size`.
- `scopedKey(runId, tool, input)`: `${runId ?? ''}|${canonicalKey(tool, input)}`.

**Collaborators**
- Imports: `node:crypto`.
- Used by: `host/approvalFlow.ts` and the MCP tool layer.

**Key behaviour and invariants**
- `stableStringify` sorts object keys, drops `undefined` properties, and maps `null` and `undefined` to `null`.
- Entries expire after 10 minutes (`TTL_MS`).
- `put` first deletes every expired entry, then stores the new one (overwrites the same key).
- `take` is single-use: it always deletes the entry, and returns `undefined` if the entry is missing or expired.
- Keys are scoped by run id, so a stale approval can never satisfy an identical call in a later run.

**Notes**
- `clear()` empties the ledger; `size()` counts stored entries, including not-yet-pruned expired ones.
