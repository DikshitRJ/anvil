export interface RawToolCall {
  id: string;
  function: { name: string; arguments: string };
  toolInfo?: { type: string; name: string; serverName?: string };
}

export interface ResolvedToolCall {
  callId: string;
  threadId: string;
  server?: string;
  tool: string;
  input: Record<string, unknown>;
}

// unwraps deferred call_tool {mcp_server, tool_name, input}
export function resolveToolCall(_call: RawToolCall, _threadId: string): ResolvedToolCall {
  throw new Error('not implemented');
}
