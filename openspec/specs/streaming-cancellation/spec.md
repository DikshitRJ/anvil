# streaming-cancellation Specification

## Purpose
Render tokens as they stream without blocking the editor, and cancel immediately on request while leaving the workspace consistent (no half-applied edits).

## Requirements

### Requirement: Token streaming
Assistant text SHALL render incrementally from `model.message.delta` events without blocking the editor.

#### Scenario: Streaming reply
- **WHEN** deltas arrive
- **THEN** the panel message grows token by token and the editor stays responsive

### Requirement: Immediate cancellation
A Stop action (panel button, `anvil.cancel` command, Escape while running) SHALL abort the stream immediately, call `sessions.cancel`, discard pending reviews, and kill running commands.

#### Scenario: Cancel mid-generation
- **WHEN** the user presses Stop during generation
- **THEN** the UI shows the run as cancelled within 200 ms of the click

### Requirement: Consistent workspace after cancel
With `anvil.cancelBehavior = revert` (default), a cancelled run SHALL restore every file it changed, and late writes MUST be refused.

#### Scenario: Cancel after partial acceptance
- **WHEN** a run is cancelled after one of three file edits was accepted
- **THEN** the accepted file is restored and `git status` shows no changes from the run
