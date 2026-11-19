import type { Mention } from './types';

export type { Mention } from './types';

export function parseMentions(
  _text: string,
  _knownFiles: ReadonlySet<string>,
): { mentions: Mention[]; cleaned: string } {
  throw new Error('not implemented');
}
