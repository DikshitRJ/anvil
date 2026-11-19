// Parses @file and @symbol mentions typed in the panel.
import type { Mention } from './types';

export type { Mention } from './types';

const RE = /(^|[\s(])@(\S+)/g;

function resolve(token: string, known: ReadonlySet<string>): Mention | undefined {
  if (known.has(token)) return { kind: 'file', value: token, raw: '' };
  const ends = [...known].filter((f) => f.endsWith(`/${token}`) || f === token);
  if (ends.length === 1) return { kind: 'file', value: ends[0], raw: '' };
  if (token.startsWith('#') && token.length > 1) return { kind: 'symbol', value: token.slice(1), raw: '' };
  if (/^[A-Za-z_][\w.]*$/.test(token)) return { kind: 'symbol', value: token, raw: '' };
  return undefined;
}

export function parseMentions(
  text: string,
  knownFiles: ReadonlySet<string>,
): { mentions: Mention[]; cleaned: string } {
  const mentions: Mention[] = [];
  const cleaned = text.replace(RE, (whole, pre: string, rawTok: string) => {
    const token = rawTok.replace(/[.,;:)!?]+$/, '');
    const m = token ? resolve(token, knownFiles) : undefined;
    if (!m) return whole;
    mentions.push({ ...m, raw: `@${token}` });
    return `${pre}${token.replace(/^#/, '')}${rawTok.slice(token.length)}`;
  });
  return { mentions, cleaned };
}
