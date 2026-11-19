import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { assembleContext, renderContextPack } from '../../src/core/context/assemble';
import { CodeIndex } from '../../src/core/context/codeIndex';
import type { ContextSignals } from '../../src/core/context/types';

const ROOT = path.join(__dirname, '..', 'fixtures', 'mini-flask');
const TASK_B =
  'Add a new built-in CLI command flask config that prints the loaded application\'s configuration as JSON, masking the values of any key containing SECRET, PASSWORD, TOKEN or KEY as "***". It must appear in flask --help, be covered by a test, and be documented alongside the other built-in commands.';
const TASK_A = "get_debug_flag treat the values 'off' and 'n' as false";

const signals = (query: string, extra: Partial<ContextSignals> = {}): ContextSignals => ({
  query,
  mentions: [],
  openFiles: [],
  recentFiles: [],
  ...extra,
});

let index: CodeIndex;
beforeAll(async () => {
  index = new CodeIndex(ROOT);
  await index.build();
});

const fileSet = (items: { path: string; kind: string }[]): Set<string> =>
  new Set(items.filter((i) => i.kind !== 'repo-map').map((i) => i.path));

describe('retrieval on mini-flask', () => {
  it('does not index gitignored files', () => {
    const files = index.files();
    expect(files.some((f) => f.startsWith('ignored_dir/'))).toBe(false);
    expect(files).toContain('src/flask/cli.py');
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it('Task B: finds cli.py, test_cli.py and docs/cli.rst within a 12000 budget', () => {
    const pack = assembleContext(index, signals(TASK_B), 12000);
    const files = fileSet(pack.items);
    for (const f of ['src/flask/cli.py', 'tests/test_cli.py', 'docs/cli.rst']) expect(files).toContain(f);
    expect(pack.used).toBeLessThanOrEqual(pack.budget);
    expect(pack.used).toBe(pack.items.reduce((a, i) => a + i.tokens, 0));
    for (const i of pack.items) expect(i.reason.length).toBeGreaterThan(0);
    expect(pack.items[pack.items.length - 1]?.kind).toBe('repo-map');
  });

  it('Task B: cli.py is among the top 3 items under a tight 4000 budget', () => {
    const pack = assembleContext(index, signals(TASK_B), 4000);
    const top = pack.items.filter((i) => i.kind !== 'repo-map').slice(0, 3);
    expect(top.map((i) => i.path)).toContain('src/flask/cli.py');
    expect(pack.used).toBeLessThanOrEqual(4000);
  });

  it('Task A: first ranked chunk is in helpers.py', () => {
    const pack = assembleContext(index, signals(TASK_A), 8000);
    expect(pack.items[0]?.path).toBe('src/flask/helpers.py');
    expect(pack.items[0]?.reason).toContain('symbol match: get_debug_flag');
  });

  it('pins file and symbol mentions first', () => {
    const s = signals('explain this', {
      mentions: [
        { kind: 'file', value: 'src/flask/config.py', raw: '@config.py' },
        { kind: 'symbol', value: 'FlaskGroup', raw: '@FlaskGroup' },
      ],
    });
    const pack = assembleContext(index, s, 12000);
    expect(pack.items[0]).toMatchObject({ path: 'src/flask/config.py', kind: 'pinned', reason: 'pinned: @mention' });
    const sym = pack.items.find((i) => i.kind === 'symbol');
    expect(sym?.path).toBe('src/flask/cli.py');
    expect(sym?.reason).toBe('pinned: @symbol FlaskGroup');
  });

  it('pins the current selection', () => {
    const selection = { path: 'src/flask/helpers.py', startLine: 10, endLine: 12, text: 'def x():\n    pass' };
    const pack = assembleContext(index, signals('change it', { selection }), 6000);
    expect(pack.items[0]).toMatchObject({ kind: 'selection', reason: 'pinned: current selection' });
  });

  it('renders an anvil_context block', () => {
    const pack = assembleContext(index, signals(TASK_A), 6000);
    const out = renderContextPack(pack);
    expect(out.startsWith('<anvil_context budget="6000"')).toBe(true);
    expect(out.trimEnd().endsWith('</anvil_context>')).toBe(true);
    expect(out).toContain('<item path="src/flask/helpers.py"');
  });

  it('findSymbol, grep and neighbors work on the fixture', () => {
    expect(index.findSymbol('get_debug_flag')[0]?.path).toBe('src/flask/helpers.py');
    expect(index.findSymbol('FlaskGroup.get_command')[0]?.container).toBe('FlaskGroup');
    expect(index.grep('FLASK_DEBUG', { glob: '*.py' }).some((g) => g.path === 'src/flask/helpers.py')).toBe(true);
    expect(index.neighbors('src/flask/helpers.py')).toContain('src/flask/cli.py');
    expect(index.repoMap({ maxTokens: 300 }).length).toBeLessThanOrEqual(300 * 4);
  });
});
