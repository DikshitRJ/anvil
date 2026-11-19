# `src/core/agent/toolCalls.ts`

**Purpose**
This file converts raw tool calls into a standardized format. It handles different tool types and extracts server names and inputs.

**Exports**
* RawToolCall: interface - Defines the structure of an incoming tool call.
* ResolvedToolCall: interface - Defines the structure of a processed tool call.
* resolveToolCall(call: RawToolCall, threadId: string): ResolvedToolCall - function - Converts a RawToolCall into a ResolvedToolCall.

**Collaborators**
Imports: Not visible from this file.
Exports: Not visible from this file.

**Key behaviour and invariants**
* The function returns an empty object if JSON parsing fails.
* The function returns an empty object if the input is not a valid object.
* The function returns undefined for the server if the value is not a string.
* The function defaults the tool name to the function name if no specific name exists.
* The function handles "truefoundry-system" and "mcp" tool types.

**Notes**
The function treats null or undefined arguments as empty objects.
