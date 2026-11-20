# `src/host/commandRunner.ts`

**Purpose**
Runs shell commands for the `run_command` tool with capped output, a timeout, and process-group kill.

**Exports**
- `CommandResult`: `exitCode` (number or null), `output`, `timedOut`.
- `CommandRunner` (implements `vscode.Disposable`): `run(command, {cwd, timeoutMs})`, `killAll()`, `dispose()`.

**Collaborators**
- Imports: `node:child_process`, `vscode`, `./cappedOutput`.
- Used by: `runController.ts` (`runCommand`, `killAll` on cancel), `extension.ts`.

**Key behaviour and invariants**
- Spawns with `shell: true`, the current environment, and (off Windows) `detached`, so the whole process group can be killed. Output goes to a `CappedOutput` and live to the "Anvil: Commands" channel (stdout and stderr interleaved).
- On timeout it sets `timedOut` and terminates: SIGTERM to the process group (negative pid; plain `kill` on Windows), then SIGKILL after 2 s unless the process has closed. Errors from an already gone process are ignored.
- `run` never rejects: a spawn error appends `spawn error: ...` to the output and resolves with `exitCode: null`.
- All live children are tracked; `killAll` terminates every one (used when a run is cancelled) and `dispose` also disposes the channel.

**Notes**
- The exit line `[exit N, timed out]` is written to the channel only.
