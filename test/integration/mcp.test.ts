import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startBridge } from '../../src/mcp/server';
import { makeFakeGate, makeFakeHost, type FakeGate, type FakeHost } from '../helpers/fakeHost';
const TOKEN = 'test-token-123';
let host: FakeHost;
let gate: FakeGate;
let bridge: Awaited<ReturnType<typeof startBridge>>;
let client: Client;

async function connect(token = TOKEN): Promise<Client> {
  const c = new Client({ name: 't', version: '0' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL(bridge.url), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  return c;
}

async function call(name: string, args: Record<string, unknown>) {
  const r = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: { text: string }[];
  };
  return { isError: r.isError === true, text: r.content[0]?.text ?? '' };
}

beforeEach(async () => {
  host = makeFakeHost({ 'a.ts': 'one\ntwo\nthree\n' });
  gate = makeFakeGate();
  bridge = await startBridge({ host, gate, port: 0, token: TOKEN });
  client = await connect();
});

afterEach(async () => {
  await client.close();
  await bridge.close();
});

describe('http security', () => {
  const post = (headers: Record<string, string>, path = '/mcp', method = 'POST') =>
    fetch(`http://127.0.0.1:${bridge.port}${path}`, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
      body: method === 'POST' ? '{}' : undefined,
    });

  it('401 without or with wrong token', async () => {
    const r = await post({});
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    expect((await post({ authorization: 'Bearer nope' })).status).toBe(401);
  });
  it('403 on foreign origin', async () => {
    expect((await post({ authorization: `Bearer ${TOKEN}`, origin: 'https://evil.com' })).status).toBe(403);
  });
  it('405 on GET and DELETE, 404 on unknown path', async () => {
    expect((await post({}, '/mcp', 'GET')).status).toBe(405);
    expect((await post({}, '/mcp', 'DELETE')).status).toBe(405);
    expect((await post({ authorization: `Bearer ${TOKEN}` }, '/other')).status).toBe(404);
  });
  it('400 on invalid JSON', async () => {
    const r = await fetch(bridge.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: '{nope',
    });
    expect(r.status).toBe(400);
  });
  it('413 on oversize body', async () => {
    const r = await fetch(bridge.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: 'x'.repeat(1024 * 1024 + 10),
    }).catch(() => null);
    // server may reset the socket after replying; either outcome rejects the body
    if (r) expect(r.status).toBe(413);
  });
  it('busy port gives a clear error', async () => {
    await expect(startBridge({ host, gate, port: bridge.port, token: TOKEN })).rejects.toThrow(/is in use/);
    const blocker = http.createServer().listen(0, '127.0.0.1');
    await new Promise((r) => blocker.once('listening', r));
    const port = (blocker.address() as { port: number }).port;
    await expect(startBridge({ host, gate, port, token: TOKEN })).rejects.toThrow(`Port ${port} is in use`);
    blocker.close();
  });
});

describe('tool listing', () => {
  it('lists 10 tools with annotations', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      [
        'edit_file',
        'find_symbol',
        'get_diagnostics',
        'grep',
        'list_files',
        'read_file',
        'repo_map',
        'run_command',
        'search_code',
        'write_file',
      ].sort(),
    );
    const by = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    for (const n of ['read_file', 'list_files', 'search_code', 'grep', 'find_symbol', 'repo_map', 'get_diagnostics']) {
      expect(by[n]?.readOnlyHint).toBe(true);
    }
    expect(by.run_command?.destructiveHint).toBe(true);
    expect(by.edit_file).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });
});

describe('read tools', () => {
  it('read_file numbers lines', async () => {
    const r = await call('read_file', { path: 'a.ts' });
    expect(r.text).toBe('a.ts (lines 1-3 of 3)\n    1| one\n    2| two\n    3| three');
  });
  it('read_file window and truncation note', async () => {
    host.files.set('big.txt', Array.from({ length: 500 }, (_, i) => `l${i + 1}`).join('\n'));
    const r = await call('read_file', { path: 'big.txt' });
    expect(r.text).toContain('(lines 1-400 of 500)');
    expect(r.text).toContain('… truncated (500 lines total); call read_file with start_line=401 to continue');
    const w = await call('read_file', { path: 'big.txt', start_line: 10, end_line: 11 });
    expect(w.text).toBe('big.txt (lines 10-11 of 500)\n   10| l10\n   11| l11');
  });
  it('read_file missing file', async () => {
    const r = await call('read_file', { path: 'nope.ts' });
    expect(r).toEqual({
      isError: true,
      text: 'File not found: nope.ts. Use list_files or search_code to locate files.',
    });
  });
  it('rejects traversal without touching the host', async () => {
    const r = await call('read_file', { path: '../../etc/passwd' });
    expect(r.isError).toBe(true);
    expect(host.calls.readFile).toEqual([]);
  });
  it('list_files, grep, find_symbol, search_code, repo_map, diagnostics', async () => {
    expect((await call('list_files', {})).text).toBe('a.ts\n(1 files)');
    expect((await call('grep', { pattern: 'two' })).text).toBe('a.ts:2: two');
    expect((await call('find_symbol', { name: 'foo' })).text).toBe('function foo — a.ts:1  function foo()');
    expect((await call('find_symbol', { name: 'zzz' })).text).toBe('No symbol named zzz. Try search_code.');
    expect((await call('search_code', { query: 'two' })).text).toContain('## a.ts:1-4  (score 7.9; matched: two)');
    expect((await call('search_code', { query: 'qqq' })).text).toBe('No matches. Try grep or different terms.');
    expect((await call('repo_map', { path: 'a.ts' })).text).toBe('map max=1500 focus=a.ts');
    expect((await call('get_diagnostics', {})).text).toBe('a.ts:2 error: boom');
  });
});

describe('edit_file / write_file', () => {
  const edit = { path: 'a.ts', old_string: 'two', new_string: '2' };

  it('applies approved edit and passes args unmodified', async () => {
    const r = await call('edit_file', edit);
    expect(r).toEqual({ isError: false, text: 'Applied edit to a.ts.' });
    expect(host.calls.applyWrite).toEqual([{ rel: 'a.ts', content: 'one\n2\nthree\n', summary: 'edit_file a.ts' }]);
    expect(gate.calls.resolveWrite[0]).toEqual({ tool: 'edit_file', args: edit });
  });
  it('applies the gate content on partial approval, with feedback', async () => {
    gate.decide = () => ({ content: 'custom\n', feedback: 'user tweaked it' });
    const r = await call('edit_file', edit);
    expect(host.files.get('a.ts')).toBe('custom\n');
    expect(r.text).toBe('Applied edit to a.ts. user tweaked it');
  });
  it('does not write when rejected', async () => {
    gate.decide = () => ({ content: null, feedback: 'nope' });
    const r = await call('edit_file', edit);
    expect(r).toEqual({ isError: false, text: 'The user rejected this edit. nope' });
    expect(host.calls.applyWrite).toEqual([]);
  });
  it('refuses when no run is active', async () => {
    gate.active = false;
    const r = await call('edit_file', edit);
    expect(r).toEqual({ isError: true, text: 'No active Anvil run — edits are refused.' });
    expect(gate.calls.resolveWrite).toEqual([]);
  });
  it('NOT_FOUND edit errors without calling the gate', async () => {
    const r = await call('edit_file', { ...edit, old_string: 'missing' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/^NOT_FOUND:/);
    expect(gate.calls.resolveWrite).toEqual([]);
  });
  it('write_file creates new files', async () => {
    const args = { path: 'dir/new.ts', content: 'hi' };
    const r = await call('write_file', args);
    expect(r.isError).toBe(false);
    expect(host.files.get('dir/new.ts')).toBe('hi');
    expect(gate.calls.resolveWrite[0]).toEqual({ tool: 'write_file', args });
  });
});

describe('run_command', () => {
  it('returns exit code and passes args untouched', async () => {
    host.nextCommand = { exitCode: 3, output: 'bad', timedOut: false };
    const args = { command: 'make' };
    const r = await call('run_command', args);
    expect(r.text).toBe('$ make\nexit code: 3\nbad');
    expect(gate.calls.authorizeCommand[0]).toEqual(args);
    expect(host.calls.runCommand[0]).toEqual({ command: 'make', cwd: undefined, timeoutMs: 120000 });
  });
  it('clamps timeout and flags timed out', async () => {
    host.nextCommand = { exitCode: null, output: '', timedOut: true };
    const r = await call('run_command', { command: 'sleep', timeout_sec: 9999 });
    expect(r.text).toContain('exit code: null (timed out)');
    expect(host.calls.runCommand[0]).toMatchObject({ timeoutMs: 600000 });
  });
  it('does not run when denied or inactive', async () => {
    gate.approveCommands = false;
    expect((await call('run_command', { command: 'rm -rf x' })).text).toBe('The user did not approve this command.');
    gate.active = false;
    expect((await call('run_command', { command: 'ls' })).isError).toBe(true);
    expect(host.calls.runCommand).toEqual([]);
  });
  it('rejects cwd outside workspace', async () => {
    const r = await call('run_command', { command: 'ls', cwd: '../..' });
    expect(r.isError).toBe(true);
    expect(host.calls.runCommand).toEqual([]);
  });
  it('caps long output keeping head and tail', async () => {
    host.nextCommand = { exitCode: 0, output: `HEAD${'x'.repeat(40000)}TAIL`, timedOut: false };
    const r = await call('run_command', { command: 'big' });
    expect(r.text).toContain('HEAD');
    expect(r.text).toContain('… [output truncated] …');
    expect(r.text.endsWith('TAIL')).toBe(true);
    expect(r.text.length).toBeLessThan(17 * 1024);
  });
});
