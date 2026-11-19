# `src/core/agent/events.ts`

**Purpose**
This file manages the state of a conversation turn. It converts raw SDK events into a structured view for the user interface.

**Exports**
* ToolStatus('streaming' | 'awaiting-approval' | 'running' | 'done' | 'denied' | 'error'): type - Defines the possible states of a tool call.
* ToolCallView: interface - Defines the structure of a tool call for the UI.
* MessageView: interface - Defines the structure of a message for the UI.
* ThreadView: interface - Defines the structure of a thread for the UI.
* TurnView: interface - Defines the structure of the complete turn snapshot.
* TurnReducer: class - Manages the state of a turn and processes incoming events.

**Collaborators**
* Imports: @truefoundry/trueforge-sdk, ./toolCalls
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The `RESULT_LIMIT` constant limits tool results to 2000 characters.
* The `apply` method ignores events without a string type.
* The `reset` method clears all internal maps, sets, and arrays.
* The `view` method returns a deep copy of the current state.
* `textOf` returns an empty string if content is not a string or an array.
* `pending` calls are cleared when a tool response or user response is received.

**Notes**
* `TurnReducer` handles both model message deltas and full message events.
* `TurnView` status can be 'running', 'paused', 'done', 'cancelled', or 'error'.
