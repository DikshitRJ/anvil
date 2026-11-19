import { describe, expect, it } from 'vitest';
import { resolveToolCall } from '../../src/core/agent/toolCalls';

describe('resolveToolCall', () => {
  it('unwraps the deferred call_tool wrapper', () => {
    const r = resolveToolCall(
      {
        id: 'c1',
        function: {
          name: 'call_tool',
          arguments: JSON.stringify({ mcp_server: 'anvil-editor', tool_name: 'edit_file', input: { path: 'a' } }),
        },
        toolInfo: { type: 'truefoundry-system', name: 'call_tool' },
      },
      'main',
    );
    expect(r).toEqual({
      callId: 'c1',
      threadId: 'main',
      server: 'anvil-editor',
      tool: 'edit_file',
      input: { path: 'a' },
    });
  });

  it('defaults a missing wrapper input to {}', () => {
    const r = resolveToolCall(
      {
        id: 'c',
        function: { name: 'call_tool', arguments: '{"mcp_server":"s","tool_name":"t"}' },
        toolInfo: { type: 'truefoundry-system', name: 'call_tool' },
      },
      'main',
    );
    expect(r.input).toEqual({});
  });

  it('resolves preloaded mcp calls', () => {
    const r = resolveToolCall(
      {
        id: 'c2',
        function: { name: 'edit_file', arguments: '{"path":"x"}' },
        toolInfo: { type: 'mcp', name: 'edit_file', serverName: 'anvil-editor' },
      },
      't1',
    );
    expect(r).toMatchObject({ server: 'anvil-editor', tool: 'edit_file', input: { path: 'x' }, threadId: 't1' });
  });

  it('resolves other system tools without a server', () => {
    const r = resolveToolCall(
      {
        id: 'c3',
        function: { name: 'ask_user_question', arguments: '{"question":"q","options":[]}' },
        toolInfo: { type: 'truefoundry-system', name: 'ask_user_question' },
      },
      'main',
    );
    expect(r.server).toBeUndefined();
    expect(r.tool).toBe('ask_user_question');
    expect(r.input).toEqual({ question: 'q', options: [] });
  });

  it('never throws on invalid JSON', () => {
    const r = resolveToolCall({ id: 'c', function: { name: 'x', arguments: '{oops' } }, 'main');
    expect(r.input).toEqual({});
    expect(r.tool).toBe('x');
  });
});
