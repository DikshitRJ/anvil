#!/usr/bin/env node
// Builds docs/WRITEUP.pdf from docs/WRITEUP.md: markdown → print-styled HTML (marked) → headless Chromium PDF.
// Usage: node scripts/docs/writeup-pdf.mjs   (set CHROME=/path/to/chrome-or-headless-shell if not auto-detected)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { marked } from 'marked';

const CSS = `@page{size:A4;margin:12mm 13mm}body{font:9.2pt/1.32 "DejaVu Sans",Arial,sans-serif;color:#111}
h1{font-size:15pt;margin:0 0 4pt}h2{font-size:11pt;margin:9pt 0 3pt;border-bottom:1px solid #ccc}h3{font-size:9.8pt;margin:6pt 0 2pt}
p,ul,ol{margin:2pt 0 4pt}li{margin:1pt 0}code{font:8.4pt "DejaVu Sans Mono",monospace;background:#f3f3f3;padding:0 2px}
pre{background:#f6f6f6;padding:4pt;font-size:8pt;white-space:pre-wrap}table{border-collapse:collapse;width:100%;margin:3pt 0;font-size:8.4pt}
th,td{border:1px solid #bbb;padding:2pt 4pt;text-align:left;vertical-align:top}th{background:#eee}a{color:#0645ad;text-decoration:none}`;

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  for (const d of readdirSync(cache).filter((n) => n.startsWith('chromium_headless_shell')).sort().reverse()) {
    const bin = join(cache, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
    if (existsSync(bin)) return bin;
  }
  return undefined;
}

const chrome = findChrome();
if (!chrome) {
  console.error('No Chromium found. Set CHROME=/path/to/chrome or run `npx playwright install chromium`.');
  process.exit(1);
}
const html = join(mkdtempSync(join(tmpdir(), 'writeup-')), 'writeup.html');
const body = marked.parse(readFileSync('docs/WRITEUP.md', 'utf8'));
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><title>Anvil write-up</title><style>${CSS}</style></head><body>${body}</body></html>`);
execFileSync(chrome, ['--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--print-to-pdf=docs/WRITEUP.pdf', `file://${html}`], { stdio: 'inherit' });
console.log('wrote docs/WRITEUP.pdf');
