// Identifier-aware tokenizer shared by indexing and querying.

const STOP = new Set(
  (
    'def self cls return import from if elif else for while in is and or not the a an to of this that ' +
    'with as const let var function true false none null undefined pass be are it on by at'
  ).split(' '),
);

// Light stemming: commands -> command.
function stem(t: string): string {
  return t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
}

function splitIdentifier(word: string): string[] {
  const spaced = word.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced.split(/[\s_]+/).filter(Boolean);
}

function keep(t: string): boolean {
  return t.length > 1 && !/^\d+$/.test(t) && !STOP.has(t);
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const word of text.split(/[^A-Za-z0-9_]+/)) {
    if (!word) continue;
    const parts = splitIdentifier(word);
    const cands = parts.length > 1 || word.includes('_') ? [word, ...parts] : [word];
    for (const c of cands) {
      const t = c.replace(/^_+|_+$/g, '').toLowerCase();
      if (keep(t)) out.push(stem(t));
    }
  }
  return out;
}
