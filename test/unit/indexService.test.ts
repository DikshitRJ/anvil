import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeIndex } from '../../src/core/context/codeIndex';

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  change: undefined as undefined | ((uri: { scheme: string; fsPath: string }) => void),
}));
vi.mock('vscode', () => ({
  FileType: { File: 1, Directory: 2 },
  Uri: { file: (fsPath: string) => ({ scheme: 'file', fsPath }) },
  workspace: {
    fs: { stat: mocks.stat, readFile: mocks.readFile },
    createFileSystemWatcher: () => ({
      dispose() {},
      onDidCreate: () => ({ dispose() {} }),
      onDidDelete: () => ({ dispose() {} }),
      onDidChange: (callback: typeof mocks.change) => {
        mocks.change = callback;
        return { dispose() {} };
      },
    }),
  },
}));
import { IndexService } from '../../src/host/indexService';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(CodeIndex.prototype, 'build').mockResolvedValue(undefined);
  mocks.stat.mockReset();
  mocks.readFile.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('incremental eligibility changes', () => {
  it.each(['binary', 'oversized', 'directory'])(
    'removes stale indexed content when a file becomes %s',
    async (kind) => {
      const service = new IndexService('/workspace', vi.fn(), vi.fn());
      service.index.updateFile('file.ts', 'export function stale_symbol() { return 1; }');
      service.start();
      mocks.stat.mockResolvedValue({ type: kind === 'directory' ? 2 : 1, size: kind === 'oversized' ? 600000 : 3 });
      mocks.readFile.mockResolvedValue(new Uint8Array([65, 0, 66]));
      mocks.change!({ scheme: 'file', fsPath: '/workspace/file.ts' });
      await vi.advanceTimersByTimeAsync(301);
      expect(service.index.getContent('file.ts')).toBeUndefined();
      expect(service.index.findSymbol('stale_symbol')).toEqual([]);
      expect(service.index.search('stale_symbol')).toEqual([]);
      service.dispose();
    },
  );
});
