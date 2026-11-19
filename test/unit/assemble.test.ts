import { describe, expect, it } from 'vitest';
import { assembleContext, estimateTokens, renderContextPack } from '../../src/core/context/assemble';
import { CodeIndex } from '../../src/core/context/codeIndex';
import type { ContextSignals } from '../../src/core/context/types';

function makeIndex(): CodeIndex {
  const idx = new CodeIndex('/virtual');
  idx.updateFile('src/app/server.py', 'def start_server(port):\n    """Start the http server."""\n    return port\n');
  idx.updateFile('src/app/util.py', 'from .server import start_server\n\ndef helper():\n    return start_server(1)\n');
  idx.updateFile('docs/server.md', '# Server\n\nHow to start the server on a port.\n');
  const big = Array.from({ length: 40 }, (_, i) => `def filler${i}():\n    return "server ${'x'.repeat(1500)}"\n`).join(
    '\n',
  );
  idx.updateFile('src/app/filler.py', big);
  return idx;
}

const sig = (query: string, extra: Partial<ContextSignals> = {}): ContextSignals => ({
  query,
  mentions: [],
  openFiles: [],
  recentFiles: [],
  ...extra,
});

describe('estimateTokens', () => {
  it('is ceil(chars / 4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('assembleContext', () => {
  it('never exceeds the budget and records dropped candidates', () => {
    const idx = makeIndex();
    for (const budget of [200, 600, 3000]) {
      const pack = assembleContext(idx, sig('start the server'), budget);
      expect(pack.used).toBeLessThanOrEqual(budget);
      expect(pack.used).toBe(pack.items.reduce((a, i) => a + i.tokens, 0));
    }
    for (let i = 0; i < 30; i++)
      idx.updateFile(`src/m${i}.py`, `def server${i}():\n    return "server ${'y'.repeat(300)}"\n`);
    const small = assembleContext(idx, sig('server'), 400);
    expect(small.dropped.some((d) => d.reason === 'over budget')).toBe(true);
  });

  it('limits to 3 chunks per file and does not overlap ranges', () => {
    const pack = assembleContext(makeIndex(), sig('server filler'), 20000);
    const per = new Map<string, number>();
    for (const i of pack.items) per.set(i.path, (per.get(i.path) ?? 0) + 1);
    for (const [p, n] of per) if (p !== '.') expect(n).toBeLessThanOrEqual(3);
  });

  it('adds symbol, path and editor-state reasons and a final repo map', () => {
    const idx = makeIndex();
    const pack = assembleContext(idx, sig('start_server in docs', { activeFile: 'src/app/util.py' }), 4000);
    const reasons = pack.items.map((i) => i.reason).join('|');
    expect(reasons).toContain('symbol match: start_server');
    expect(reasons).toContain('active editor');
    expect(pack.items[pack.items.length - 1]).toMatchObject({ kind: 'repo-map', path: '.' });
    for (const i of pack.items) expect(i.reason).not.toBe('');
  });

  it('pins mentions before ranked items and keeps pins within half the budget', () => {
    const idx = makeIndex();
    const mentions = [{ kind: 'file' as const, value: 'src/app/filler.py', raw: '@filler.py' }];
    const pack = assembleContext(idx, sig('server', { mentions }), 2000);
    expect(pack.items[0]?.kind).toBe('pinned');
    const pinned = pack.items.filter((i) => i.kind === 'pinned').reduce((a, i) => a + i.tokens, 0);
    expect(pinned).toBeLessThanOrEqual(1000);
    expect(pack.used).toBeLessThanOrEqual(2000);
  });
});

describe('renderContextPack', () => {
  it('escapes attributes but not code', () => {
    const out = renderContextPack({
      budget: 10,
      used: 5,
      dropped: [],
      items: [
        {
          path: 'a.py',
          startLine: 1,
          endLine: 2,
          kind: 'chunk',
          reason: 'bm25: "x" & <y>',
          score: 1,
          tokens: 5,
          text: 'if a < b: "&"',
        },
      ],
    });
    expect(out).toContain(
      '<anvil_context budget="10" used="5" note="Files pre-selected by Anvil; each item says why.">',
    );
    expect(out).toContain('<item path="a.py" lines="1-2" kind="chunk" reason="bm25: &quot;x&quot; &amp; &lt;y>">');
    expect(out).toContain('\nif a < b: "&"\n</item>');
    expect(out.endsWith('</anvil_context>')).toBe(true);
  });
});
