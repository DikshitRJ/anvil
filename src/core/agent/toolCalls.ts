// Resolves raw TrueForge tool calls (including the deferred `call_tool` wrapper) to server/tool/input.
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

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function parseObject(json: string | undefined): Record<string, unknown> {
  try {
    return asObject(JSON.parse(json ?? ''));
  } catch {
    return {};
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

// unwraps deferred call_tool {mcp_server, tool_name, input}
export function resolveToolCall(call: RawToolCall, threadId: string): ResolvedToolCall {
  const args = parseObject(call.function.arguments);
  const info = call.toolInfo;
  const base = { callId: call.id, threadId };
  if (info?.type === 'truefoundry-system' && info.name === 'call_tool') {
    return {
      ...base,
      server: str(args.mcp_server),
      tool: str(args.tool_name) ?? call.function.name,
      input: asObject(args.input),
    };
  }
  if (info?.type === 'mcp') {
    return { ...base, server: info.serverName, tool: info.name ?? call.function.name, input: args };
  }
  return { ...base, tool: call.function.name, input: args };
}
