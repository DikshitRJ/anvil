import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FINAL_TEXT, SELECTION_REPLY, startMockLlm, type MockLlm } from '../../test/e2e/mockLlm';

let mock: MockLlm;

beforeEach(async () => {
  mock = await startMockLlm();
});

afterEach(async () => {
  await mock.close();
});

const SEARCH_TOOL = { type: 'function', function: { name: 'mcp__anvil-editor__search_code' } };
const EDIT_TOOL = { type: 'function', function: { name: 'mcp__anvil-editor__edit_file' } };
const CALL_TOOL = { type: 'function', function: { name: 'call_tool' } };
const USER = { role: 'user', content: 'Make greet return hello, world' };

function post(body: unknown): Promise<Response> {
  return fetch(`${mock.url}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface Sse {
  lines: string[];
  events: Record<string, unknown>[];
  text: string;
  name: string;
  args: string;
  fragments: number;
  usage: unknown;
}

// Parses a streamed body: every event line starts with "data: " and the last one is [DONE].
async function sse(res: Response): Promise<Sse> {
  const raw = await res.text();
  const lines = raw
    .split('\n\n')
    .filter((l) => l !== '')
    .map((l) => l.replace(/^data: /, ''));
  const events = lines.filter((l) => l !== '[DONE]').map((l) => JSON.parse(l) as Record<string, unknown>);
  const out: Sse = { lines, events, text: '', name: '', args: '', fragments: 0, usage: undefined };
  for (const e of events) {
    const choices = (e.choices ?? []) as { delta?: Record<string, unknown> }[];
    if (e.usage !== undefined) out.usage = e.usage;
    for (const c of choices) {
      const delta = c.delta ?? {};
      if (typeof delta.content === 'string') out.text += delta.content;
      for (const tc of (delta.tool_calls ?? []) as { function?: { name?: string; arguments?: string } }[]) {
        if (tc.function?.name) out.name = tc.function.name;
        if (tc.function?.arguments) {
          out.args += tc.function.arguments;
          out.fragments++;
        }
      }
    }
  }
  return out;
}

describe('mockLlm', () => {
  it('answers a non-streaming plain-text request with chat.completion JSON', async () => {
    const res = await post({ messages: [USER], stream: false });
    const json = (await res.json()) as { object: string; choices: { message: { content: string } }[] };
    expect(json.object).toBe('chat.completion');
    expect(json.choices[0]?.message.content).toBe('ok');
  });

  it('streams text as chunks that end with [DONE]', async () => {
    const out = await sse(await post({ messages: [USER], stream: true }));
    expect(out.lines[out.lines.length - 1]).toBe('[DONE]');
    expect(out.events.every((e) => e.object === 'chat.completion.chunk')).toBe(true);
    expect(out.text).toBe('ok');
  });

  it('returns the fenced python block when the last user message contains SELECTION', async () => {
    const sel = { role: 'user', content: 'SELECTION: def greet(): pass' };
    const out = await sse(await post({ messages: [sel], stream: true }));
    expect(out.text).toBe(SELECTION_REPLY);
  });

  it('streams a search_code tool call in at least two argument fragments', async () => {
    const out = await sse(await post({ messages: [USER], tools: [SEARCH_TOOL], stream: true }));
    expect(out.name.endsWith('search_code')).toBe(true);
    expect(JSON.parse(out.args)).toEqual({ query: 'greet function' });
    expect(out.fragments).toBeGreaterThanOrEqual(2);
  });

  it('moves on to edit_file after a search_code result and to the final text after edit_file', async () => {
    const search = {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'c1', type: 'function', function: { name: 'mcp__anvil-editor__search_code', arguments: '{}' } },
      ],
    };
    const afterSearch = await sse(
      await post({
        messages: [USER, search, { role: 'tool', tool_call_id: 'c1', content: 'found' }],
        tools: [SEARCH_TOOL, EDIT_TOOL],
        stream: true,
      }),
    );
    expect(afterSearch.name.endsWith('edit_file')).toBe(true);
    expect(JSON.parse(afterSearch.args)).toMatchObject({ path: 'src/app.py' });

    const edit = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'c2', type: 'function', function: { name: 'mcp__anvil-editor__edit_file', arguments: '{}' } }],
    };
    const done = await post({
      messages: [
        USER,
        search,
        { role: 'tool', tool_call_id: 'c1', content: 'found' },
        edit,
        { role: 'tool', tool_call_id: 'c2', content: 'ok' },
      ],
      tools: [SEARCH_TOOL, EDIT_TOOL],
      stream: false,
    });
    const json = (await done.json()) as { choices: { message: { content: string } }[] };
    expect(json.choices[0]?.message.content).toBe(FINAL_TEXT);
  });

  it('routes through call_tool when only the deferred meta tool is offered, for both steps', async () => {
    const first = await sse(await post({ messages: [USER], tools: [CALL_TOOL], stream: true }));
    expect(first.name).toBe('call_tool');
    expect(JSON.parse(first.args)).toMatchObject({ mcp_server: 'anvil-editor', tool_name: 'search_code' });

    const deferred = {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'd1',
          type: 'function',
          function: {
            name: 'call_tool',
            arguments: JSON.stringify({ mcp_server: 'anvil-editor', tool_name: 'search_code', input: {} }),
          },
        },
      ],
    };
    const second = await sse(
      await post({
        messages: [USER, deferred, { role: 'tool', tool_call_id: 'd1', content: 'found' }],
        tools: [CALL_TOOL],
        stream: true,
      }),
    );
    expect(second.name).toBe('call_tool');
    expect(JSON.parse(second.args)).toMatchObject({ tool_name: 'edit_file' });
  });

  it('ignores platform-only tools: a plain SELECTION reply still comes back as text', async () => {
    const platform = { type: 'function', function: { name: 'ask_user_question' } };
    const sel = { role: 'user', content: 'SELECTION: def greet(): pass' };
    const out = await sse(await post({ messages: [sel], tools: [platform], stream: true }));
    expect(out.text).toBe(SELECTION_REPLY);
    expect(out.name).toBe('');
  });

  it('adds a usage chunk before [DONE] when include_usage is requested', async () => {
    const out = await sse(await post({ messages: [USER], stream: true, stream_options: { include_usage: true } }));
    expect(out.usage).toBeDefined();
    expect(out.lines[out.lines.length - 1]).toBe('[DONE]');
  });

  it('records requests and the tool names offered', async () => {
    await post({ messages: [USER], tools: [SEARCH_TOOL], stream: false });
    expect(mock.requests).toHaveLength(1);
    expect(mock.toolNamesSeen.has('mcp__anvil-editor__search_code')).toBe(true);
  });

  it('never answers in hang mode until the client gives up', async () => {
    mock.setMode('hang');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300);
    await expect(
      fetch(`${mock.url}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [USER] }),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    clearTimeout(timer);
    mock.setMode('script');
  });
});
