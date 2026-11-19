export class PathError extends Error {}

// absolute; throws PathError on escape/absolute-outside/NUL
export function resolveInWorkspace(_root: string, _p: string): string {
  throw new Error('not implemented');
}

// POSIX separators
export function toRelative(_root: string, _abs: string): string {
  throw new Error('not implemented');
}
