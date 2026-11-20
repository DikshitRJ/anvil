# `src/host/indexService.ts`

**Purpose**
Owns the `CodeIndex`: an initial asynchronous build plus incremental updates from a debounced file watcher.

**Exports**
- `IndexService(root, onStatus, log)` (implements `vscode.Disposable`): `index`, `ready`, `start()`, `dispose()`.

**Collaborators**
- Imports: `vscode`, `../core/context/codeIndex`, `../core/paths` (`toRelative`), `./panelEvents` (`isIgnoredPath`).
- Used by: `extension.ts`, run controller (context), MCP host.

**Key behaviour and invariants**
- `start` reports `{ready:false, files:0}`, builds the index reporting progress, sets `ready` and reports the final count. A failed build is only logged (the index stays not ready).
- A `**/*` watcher queues create/change/delete events. Non-`file` URIs, paths outside the root (`..`) and ignored paths (`isIgnoredPath`) are dropped. A later event for a path replaces the earlier opposite one.
- Events are debounced 300 ms, then deleted files are removed and changed files are refreshed in parallel; status is reported after each flush.
- `refresh` re-reads the file and updates the index; it skips (leaves the old entry) non-files, files over 512 KB and binary files (NUL byte); if stat or read throws (e.g. the file vanished), the file is removed from the index.

**Notes**
- Searches issued before `ready` see a partial index; callers check `ready`.
