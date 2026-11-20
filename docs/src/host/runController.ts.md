# `src/host/runController.ts`

**Purpose**
Owns the chat AnvilSession, checkpoints, and the active run. Handles panel messages and implements WriteGate to route writes through review.

**Exports**
* RunDeps (interface): Defines the dependencies required by the RunController.
* RunController (class): Manages the lifecycle of runs, sessions, and file operations.

**Collaborators**
* Imports:
    * `vscode`: Provides VS Code API for commands, window messages, and text documents.
    * `@truefoundry/trueforge-sdk`: Provides the TrueForge client.
    * `../core/agent/fallback`: Provides ModelRelay for model handling.
    * `../core/context/assemble`: Provides context assembly and rendering.
    * `../core/context/codeIndex`: Provides the code index for context.
    * `../core/context/mentions`: Provides mention parsing.
    * `../core/context/types`: Provides ContextSignals types.
    * `../core/config`: Provides AnvilConfig.
    * `../core/paths`: Provides workspace path resolution.
    * `../core/transaction`: Provides CheckpointStore and RestoreReport.
    * `../mcp/server`: Provides WorkspaceHost and WriteGate types.
    * `../panel/protocol`: Provides HostToWebview and WebviewToHost types.
    * `../trueforge/session`: Provides AnvilSession, RunHooks, and RunResult.
    * `../trueforge/spec`: Provides AgentDefinition.
    * `./approvalFlow`: Provides ApprovalFlow for gated actions.
    * `./commandRunner`: Provides CommandRunner for executing commands.
    * `./fileStore`: Provides VsCodeFileStore for file persistence.
    * `./panelEvents`: Provides diffTurn, emptySnapshot, and matchMentions.
    * `./reviewController`: Provides ReviewController for write review.
    * `./statusBar`: Provides AnvilStatusBar for UI status.
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `isRunActive` returns true only if an active run exists and is not cancelled.
* `isBusy` returns true if `inFlight` is greater than 0.
* `applyWrite` throws an error if the run is not active.
* `applyStandalone` throws an error if the file content changed since the change was reviewed.
* `runCommand` throws an error if the run is not active.
* `startRun` prevents starting a new run if one is already in progress.
* `trackSaved` maintains a list of the 10 most recent file paths.
* `cancel` sets `cancelled` to true, cancels the session, cancels pending reviews, kills running commands, rejects pending approvals and clears the approval flow.
* `newChat` cancels the current run, disposes the session, and clears the flow.
* `restoreWithPrompt` prompts the user if files have changed since the checkpoint was recorded.

**Notes**
* `applyWrite` falls back to the runId 'manual' when no active run id is set. The active-run check runs first, so this fallback is not reached.
* `openFile` catches errors and logs them to the host.
* `execute` handles errors by creating a RunResult with an 'error' status.
* `execute` reverts the run only when `cancelBehavior` is 'revert'. It reverts when the run is cancelled, or when it fails and the run has checkpoints.
* `buildInput` notifies the panel of the run start and context items.
* `signals` filters out files outside the workspace root.
