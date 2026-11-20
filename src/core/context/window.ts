// Trim an oversized chunk to a window of lines around its query-matched lines.
import { tokenize } from './tokenize';
import type { Chunk } from './types';

function lineHits(lines: string[], q: Set<string>): number[] {
  return lines.map((l) => tokenize(l).filter((t) => q.has(t)).length);
}

function bestCenter(hits: number[]): number {
  let best = 0;
  hits.forEach((h, i) => {
    if (h > (hits[best] ?? 0)) best = i;
  });
  return best;
}

// Grow [lo, hi] around `center` (alternating up/down) while the text stays within maxChars.
function grow(lines: string[], center: number, maxChars: number): [number, number] {
  let lo = center;
  let hi = center;
  let used = (lines[center] ?? '').length;
  let up = true;
  for (let stuck = 0; stuck < 2; up = !up) {
    const next = up ? lo - 1 : hi + 1;
    const line = lines[next];
    if (line === undefined || used + line.length + 1 > maxChars) {
      stuck++;
      continue;
    }
    stuck = 0;
    used += line.length + 1;
    if (up) lo = next;
    else hi = next;
  }
  return [lo, hi];
}

export function windowChunk(c: Chunk, q: Set<string>, maxTokens: number): Chunk {
  const maxChars = maxTokens * 4;
  if (c.text.length <= maxChars) return c;
  const lines = c.text.split('\n');
  const center = bestCenter(lineHits(lines, q));
  const [lo, hi] = grow(lines, center, maxChars);
  const text = lines
    .slice(lo, hi + 1)
    .join('\n')
    .slice(0, maxChars);
  return { ...c, text, startLine: c.startLine + lo, endLine: c.startLine + hi };
}
