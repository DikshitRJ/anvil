# `src/core/ledger.ts`

**Purpose**
This file manages a ledger of review outcomes. It stores and retrieves entries based on a unique hash of tool names and arguments.

**Exports**
* stableStringify(value: unknown): string - function: It converts a value into a consistent string format.
* canonicalKey(tool: string, args: unknown): string - function: It creates a SHA-256 hash from a tool name and its arguments.
* LedgerEntry: interface: It defines the structure for a review entry.
* ApprovalLedger: class: It provides methods to store, retrieve, and clear ledger entries.

**Collaborators**
* Imports: node:crypto
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The ledger removes entries older than 10 minutes (600,000 milliseconds) during every `put` operation.
* The `take` method removes the entry from the ledger when it is retrieved.
* The `stableStringify` function sorts object keys alphabetically to ensure consistent hashes.
* The `canonicalKey` function uses a newline character to separate the tool name and the arguments.

**Notes**
* The `stableStringify` function returns "null" for null or undefined values.
* The `put` method performs a full scan of the map to delete expired entries.
