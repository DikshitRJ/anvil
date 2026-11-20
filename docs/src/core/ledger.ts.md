# `src/core/ledger.ts`

**Purpose**
This file manages an approval ledger that tracks review outcomes. It provides mechanisms to generate stable keys and store entries with a time-to-live (TTL) expiration.

**Exports**
* stableStringify(value: unknown): function: Converts a value into a deterministic string representation.
* canonicalKey(tool: string, args: unknown): function: Generates a sha256 hex hash of a tool and its stable stringified arguments.
* LedgerEntry: interface: Defines the structure for a ledger entry including content, hunk counts, and feedback.
* ApprovalLedger: class: Manages a map of ledger entries with expiration logic.
* scopedKey(runId: string | undefined, tool: string, input: Record<string, unknown>): function: Generates a key scoped by a run ID and a canonical key.

**Collaborators**
* Imports: node:crypto (createHash) is used to generate sha256 hashes.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* stableStringify sorts object keys alphabetically to ensure deterministic output.
* canonicalKey uses the format `${tool}\n${stableStringify(args)}` for hashing.
* ApprovalLedger uses a TTL_MS of 10 * 60 * 1000 (10 minutes).
* put() removes all entries from the map that are older than TTL_MS before adding a new entry.
* take() removes the entry from the map regardless of its age, but returns undefined if the entry is older than TTL_MS.
* scopedKey prepends the runId (or an empty string) to the canonical key using a pipe separator.

**Notes**
* LedgerEntry.acceptedHunks is marked as deprecated and unused.
* stableStringify returns 'null' for null or undefined values.
* stableStringify filters out keys where the value is undefined.
