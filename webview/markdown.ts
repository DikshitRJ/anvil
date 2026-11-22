// Tiny SAFE markdown renderer: escapes all HTML first, then applies a small markdown subset.
// Never emits <a>, <img>, event attributes or javascript: URLs (links become plain text).

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text: string): string {
  const codes: string[] = [];
  let out = text.replace(/`([^`\n]+)`/g, (_m, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\uE000${codes.length - 1}\uE000`;
  });
  out = out.replace(/\[([^\]\n]+)\]\(([^)\n]*)\)/g, '$1 ($2)');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  out = out.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  return out.replace(/\uE000(\d+)\uE000/g, (_m, i: string) => codes[Number(i)] ?? '');
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^&gt;\s?(.*)$/;

function codeBlock(lang: string, lines: string[]): string {
  const cls = lang ? ` class="lang-${lang}"` : '';
  return `<pre><code${cls}>${lines.join('\n')}</code></pre>`;
}

/** Consume consecutive lines matching `re`; returns the captured texts and next index. */
function takeRun(lines: string[], start: number, re: RegExp): [string[], number] {
  const items: string[] = [];
  let i = start;
  for (; i < lines.length; i++) {
    const m = re.exec(lines[i] ?? '');
    if (!m) break;
    items.push(m[1] ?? '');
  }
  return [items, i];
}

function isBlockStart(line: string): boolean {
  return (
    line.trim() === '' || FENCE.test(line) || HEADING.test(line) || UL.test(line) || OL.test(line) || QUOTE.test(line)
  );
}

function paragraph(lines: string[], start: number): [string, number] {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length && (i === start || !isBlockStart(lines[i] ?? ''))) {
    parts.push(inline(lines[i] ?? ''));
    i++;
  }
  return [`<p>${parts.join('<br>')}</p>`, i];
}

function fence(lines: string[], start: number, lang: string, marker: string): [string, number] {
  const close = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !close.test(lines[i] ?? '')) body.push(lines[i++] ?? '');
  return [codeBlock(lang, body), i + 1]; // unterminated fence (streaming) just ends the block
}

function block(lines: string[], i: number): [string, number] {
  const line = lines[i] ?? '';
  const f = FENCE.exec(line);
  if (f) return fence(lines, i, f[2] ?? '', f[1]!);
  const h = HEADING.exec(line);
  if (h) {
    const level = (h[1]?.length ?? 1) + 3;
    return [`<h${level}>${inline(h[2] ?? '')}</h${level}>`, i + 1];
  }
  for (const [re, tag] of [
    [UL, 'ul'],
    [OL, 'ol'],
  ] as const) {
    if (!re.test(line)) continue;
    const [items, next] = takeRun(lines, i, re);
    return [`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`, next];
  }
  if (QUOTE.test(line)) {
    const [items, next] = takeRun(lines, i, QUOTE);
    return [`<blockquote>${items.map(inline).join('<br>')}</blockquote>`, next];
  }
  return paragraph(lines, i);
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src.replace(/\uE000/g, ''))
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if ((lines[i] ?? '').trim() === '') {
      i++;
      continue;
    }
    const [html, next] = block(lines, i);
    out.push(html);
    i = next;
  }
  return out.join('');
}
