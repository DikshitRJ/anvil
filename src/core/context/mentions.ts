// Parses @file and @symbol mentions typed in the panel.
import type { Mention } from './types';

export type { Mention } from './types';

const RE = /(^|[\s(])@(?:"((?:\\.|[^"\\\n])+)"|'((?:\\.|[^'\\\n])+)'|(\S+))/g;

/** A file suggestion must round-trip even when its path contains spaces, quotes, or trailing punctuation. */
export function formatFileMention(path: string): string {
  return /[\s"'\\]|[.,;:)!?]$/.test(path) ? `@${JSON.stringify(path)}` : `@${path}`;
}

function resolve(token: string, known: ReadonlySet<string>): Mention | undefined {
  if (known.has(token)) return { kind: 'file', value: token, raw: '' };
  const ends = [...known].filter((f) => f.endsWith(`/${token}`) || f === token);
  if (ends.length === 1) return { kind: 'file', value: ends[0]!, raw: '' };
  if (token.startsWith('#') && token.length > 1) return { kind: 'symbol', value: token.slice(1), raw: '' };
  if (/^[A-Za-z_][\w.]*$/.test(token)) return { kind: 'symbol', value: token, raw: '' };
  return undefined;
}

function quotedToken(text: string, double: boolean): string | undefined {
  try {
    return double ? (JSON.parse(`"${text}"`) as string) : text.replace(/\\(['\\])/g, '$1');
  } catch {
    return undefined;
  }
}

export function parseMentions(text: string, knownFiles: ReadonlySet<string>): { mentions: Mention[]; cleaned: string } {
  const mentions: Mention[] = [];
  const cleaned = text.replace(
    RE,
    (whole, pre: string, double: string | undefined, single: string | undefined, bare: string | undefined) => {
      const quoted = double ?? single;
      const rawTok = quoted ?? bare ?? '';
      const token =
        quoted === undefined ? rawTok.replace(/[.,;:)!?]+$/, '') : quotedToken(rawTok, double !== undefined);
      const m = token ? resolve(token, knownFiles) : undefined;
      if (!m || token === undefined) return whole;
      const quote = double !== undefined ? '"' : "'";
      const raw = quoted === undefined ? `@${token}` : `@${quote}${rawTok}${quote}`;
      mentions.push({ ...m, raw });
      return quoted === undefined
        ? `${pre}${token.replace(/^#/, '')}${rawTok.slice(token.length)}`
        : `${pre}${quote}${rawTok.replace(/^#/, '')}${quote}`;
    },
  );
  return { mentions, cleaned };
}
