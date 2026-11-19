import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PathError, resolveInWorkspace, toRelative } from '../../src/core/paths';

const root = path.resolve('/ws/proj');

describe('resolveInWorkspace', () => {
  it('resolves relative paths', () => {
    expect(resolveInWorkspace(root, 'src/a.ts')).toBe(path.join(root, 'src/a.ts'));
    expect(resolveInWorkspace(root, './src\\a.ts')).toBe(path.join(root, 'src/a.ts'));
    expect(resolveInWorkspace(root, 'a/../b')).toBe(path.join(root, 'b'));
  });
  it('maps empty and dot to root', () => {
    expect(resolveInWorkspace(root, '')).toBe(root);
    expect(resolveInWorkspace(root, '.')).toBe(root);
  });
  it('allows absolute inside root', () => {
    expect(resolveInWorkspace(root, path.join(root, 'x'))).toBe(path.join(root, 'x'));
  });
  it('rejects escapes, outside absolutes and NUL', () => {
    expect(() => resolveInWorkspace(root, '../x')).toThrow(PathError);
    expect(() => resolveInWorkspace(root, '..')).toThrow('Path escapes the workspace: ..');
    expect(() => resolveInWorkspace(root, 'a/../../x')).toThrow(PathError);
    expect(() => resolveInWorkspace(root, '/etc/passwd')).toThrow(PathError);
    expect(() => resolveInWorkspace(root, 'a\0b')).toThrow(PathError);
    expect(() => resolveInWorkspace(root, '..\\x')).toThrow(PathError);
  });
  it('does not treat sibling prefix as inside', () => {
    expect(() => resolveInWorkspace(root, '/ws/proj-evil/x')).toThrow(PathError);
  });
});

describe('toRelative', () => {
  it('returns posix paths and . for root', () => {
    expect(toRelative(root, path.join(root, 'a', 'b.ts'))).toBe('a/b.ts');
    expect(toRelative(root, root)).toBe('.');
  });
});
