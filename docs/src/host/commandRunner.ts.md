# `src/host/commandRunner.ts`

**Purpose**
This file manages the execution of shell commands for the `run_command` tool. It handles process spawning, output capping, timeouts, and lifecycle management of child processes.

**Exports**
* CommandResult (interface): Defines the structure of the result containing exitCode, output, and timedOut status.
* CommandRunner (class): Implements `vscode.Disposable` to run, monitor, and terminate shell commands.

**Collaborators**
* Imports:
    * `node:child_process`: Provides `spawn` and `ChildProcess` for process management.
    * `vscode`: Provides `vscode.Disposable` and `vscode.window.createOutputChannel`.
    * `./cappedOutput`: Provides the `CappedOutput` class to limit output size.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `CommandRunner` creates a VS Code output channel named 'Anvil: Commands'.
* The `run` method spawns a process with `shell: true` and uses the current `process.env`.
* Processes are spawned as `detached` only if the platform is not `win32`.
* The `terminate` function sends `SIGTERM`, waits 2000ms, and then sends `SIGKILL`.
* `killTree` sends signals to the process group (negative PID) on non-win32 platforms.
* The `run` method resolves a `CommandResult` even if the process encounters a spawn error.
* `killAll` iterates through the `running` Set to terminate all active processes.
* `dispose` calls `killAll` and disposes of the output channel.

**Notes**
* `killTree` catches errors to handle cases where the process is already gone.
* `terminate` uses `setTimeout(...).unref()` to ensure the timer does not keep the Node.js process alive.
* `onData` handles both `stdout` and `stderr` by appending to the `CappedOutput` and the output channel.
* `timedOut` is set to true if the process exceeds `opts.timeoutMs`.
