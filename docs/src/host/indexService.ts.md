# `src/host/indexService.ts`

**Purpose**
This file manages the `CodeIndex` lifecycle by performing an initial asynchronous build and handling incremental updates. It uses a debounced `FileSystemWatcher` to synchronize the index with file system changes.

**Exports**
* IndexService(root: string, onStatus: (state: { ready: boolean; files: number }) => void, log: (msg: string) => void): class Implements vscode.Disposable: Defines the service that manages the code index and file system watching.

**Collaborators**
* Imports:
    * `vscode`: Provides the `Disposable` interface, `workspace` for file system watching and stats, and `Uri` for path handling.
    * `../core/context/codeIndex`: Provides the `CodeIndex` class used to store and update the index.
    * `../core/paths`: Provides `toRelative` to convert absolute paths to relative paths.
    * `./panelEvents`: Provides `isIgnoredPath` to filter out specific paths from indexing.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `MAX_BYTES` is set to 524288 (512 * 1024) bytes.
* `DEBOUNCE_MS` is set to 300 milliseconds.
* The `queue` method ignores URIs that do not have the `file` scheme.
* The `queue` method ignores paths that start with `..` or are identified by `isIgnoredPath`.
* The `refresh` method ignores files that are not of type `vscode.FileType.File`.
* The `refresh` method ignores files larger than `MAX_BYTES`.
* The `refresh` method ignores files containing a `0` byte, treating them as binary.
* The `flush` method clears the `changed` and `deleted` sets after copying their contents to arrays.
* The `dispose` method clears the active timer and disposes of all registered `vscode.Disposable` objects.

**Notes**
* If `refresh` throws an error, the file is removed from the index via `index.removeFile`.
* The `start` method logs an error message to the provided `log` function if the initial build fails.
* `onStatus` is called with `ready: false` at the start of the build and updated upon completion or failure.
