// Renders PanelState into the DOM. Elements are keyed (data-key), created once and patched only
// when their signature changes; all HTML is built from escaped strings. Events use delegation
// (data-action attributes) handled in main.ts.
import { escapeHtml as esc, renderMarkdown } from './markdown';
import type { Entry, GlobalNotice, PanelState, Run, ThreadInfo } from './state';

/** A keyed node: `sig` decides whether `html` must be re-applied. Nodes with `children` are <details>. */
export interface Item {
  key: string;
  sig: string;
  html: string;
  children?: Item[];
  open?: boolean;
}

/** User-toggled <details> state, keyed by data-dk; overrides defaults across re-renders. */
const toggled = new Map<string, boolean>();
export function recordToggle(dk: string, open: boolean): void {
  toggled.set(dk, open);
}
const isOpen = (dk: string, dflt: boolean): boolean => toggled.get(dk) ?? dflt;

// ---------- pure HTML builders ----------

const GLYPHS: [RegExp, string][] = [
  [/search|grep|find/, '⌕'],
  [/read|view|open/, '\u{1F4C4}'],
  [/edit|write|patch|replace/, '✎'],
  [/command|run|exec|shell|bash/, '▶'],
];
export const toolGlyph = (tool: string): string => GLYPHS.find(([re]) => re.test(tool))?.[1] ?? '⚙';

const fmtK = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n));
const badge = (status: string): string => `<span class="badge st-${esc(status)}">${esc(status)}</span>`;
const btn = (label: string, attrs: string, cls = 'btn'): string =>
  `<button type="button" class="${cls}" ${attrs}>${esc(label)}</button>`;

export function toolCardHtml(e: Extract<Entry, { kind: 'tool' }>): string {
  const title = `${esc(e.tool)} ${esc(e.summary)}`;
  const body = e.result ? `<pre class="result">${esc(e.result)}</pre>` : '';
  const dk = `tool:${e.id}`;
  return `<details class="card tool" data-dk="${esc(dk)}"${isOpen(dk, false) ? ' open' : ''}>
<summary><span class="glyph">${toolGlyph(e.tool)}</span><span class="title">${title}</span>${badge(e.status)}</summary>${body}</details>`;
}

export function approvalHtml(e: Extract<Entry, { kind: 'approval' }>): string {
  if (e.outcome) return `<div class="card approval resolved">${esc(e.title)} · ${esc(e.outcome)}</div>`;
  if (e.approvalKind === 'edit') {
    return `<div class="card approval"><span class="spinner" aria-hidden="true"></span>Review the changes to <b>${esc(e.title)}</b> in the editor — accept or reject each hunk</div>`;
  }
  const id = esc(e.id);
  return `<div class="card approval"><div class="title">${esc(e.title)}</div><pre>${esc(e.detail)}</pre>
<div class="row">${btn('Allow', `data-action="approve" data-id="${id}" data-allow="1"`, 'btn primary')}${btn('Deny', `data-action="approve" data-id="${id}" data-allow="0"`, 'btn secondary')}</div></div>`;
}

function noticeHtml(level: string, message: string, actions: string[]): string {
  const acts = actions.map((a) => btn(a, `data-action="notice-action" data-value="${esc(a)}"`, 'btn small')).join('');
  return `<div class="notice lvl-${esc(level)}" role="status"><span>${esc(message)}</span>${acts}</div>`;
}

export function entryHtml(e: Entry): string {
  switch (e.kind) {
    case 'text':
      return `<div class="msg md">${renderMarkdown(e.content)}</div>`;
    case 'tool':
      return toolCardHtml(e);
    case 'approval':
      return approvalHtml(e);
    case 'notice':
      return noticeHtml(e.level, e.message, e.actions);
    case 'modelSwitch':
      return `<div class="notice lvl-warn">Switched model: ${esc(e.from)} → ${esc(e.to)}<span class="reason">${esc(e.reason)}</span></div>`;
  }
}

export function contextHtml(run: Run, isLatest: boolean): string {
  const c = run.context;
  if (!c) return '';
  const pct = c.budget > 0 ? Math.min(100, Math.round((c.used / c.budget) * 100)) : 0;
  const level = pct >= 95 ? 'full' : pct >= 80 ? 'high' : 'ok';
  const rows = c.items.map((it) => {
    const range = it.startLine ? `:${it.startLine}${it.endLine ? `-${it.endLine}` : ''}` : '';
    const line = it.startLine ? ` data-line="${it.startLine}"` : '';
    return `<li><a role="button" tabindex="0" class="ctx-item" data-action="openFile" data-path="${esc(it.path)}"${line}>${esc(it.path)}${range}</a> · ${esc(it.reason)} · ${it.tokens} tok</li>`;
  });
  const dropped = c.dropped > 0 ? `<div class="dropped">+${c.dropped} candidates dropped (over budget)</div>` : '';
  const dk = `ctx:${run.runId}`;
  return `<details class="card ctx" data-dk="${esc(dk)}"${isOpen(dk, isLatest) ? ' open' : ''}>
<summary>Context · ${fmtK(c.used)} / ${fmtK(c.budget)} tokens</summary>
<div class="bar ${level}" role="progressbar" aria-valuemin="0" aria-valuemax="${c.budget}" aria-valuenow="${c.used}"><span style="width:${pct}%"></span></div>
<ul>${rows.join('')}</ul>${dropped}</details>`;
}

export function footerHtml(run: Run): string {
  const f = run.finished;
  if (!f) return '';
  const status = { done: '✓ done', cancelled: '■ cancelled', error: '✕ error' }[f.status];
  const err = f.error ? ` — ${esc(f.error)}` : '';
  const m = f.metrics ?? {};
  const bits = [f.model, m.tokens ? `${fmtK(m.tokens)} tok` : '', m.cost ? `$${m.cost.toFixed(4)}` : ''];
  const open = f.sessionId ? btn('Open in TrueForge', 'data-action="openSession"', 'link') : '';
  return `<div class="footer st-${f.status}"><span>${status}${err}</span><span class="meta">${bits.filter(Boolean).map(esc).join(' · ')}</span>${open}</div>`;
}

export function changesHtml(state: PanelState): string {
  if (state.changes.length === 0) return '';
  const byRun = new Map<string, PanelState['changes']>();
  for (const c of state.changes) byRun.set(c.runId, [...(byRun.get(c.runId) ?? []), c]);
  const groups = [...byRun].map(([runId, list]) => {
    const rows = list.map((c) => {
      const time = new Date(c.at).toLocaleTimeString();
      return `<li><span class="path">${esc(c.path)}</span> · ${esc(c.summary)} · <time>${esc(time)}</time>${btn('Undo', `data-action="undoChange" data-seq="${c.seq}"`, 'btn small')}</li>`;
    });
    const revert = btn('Revert run', `data-action="revertRun" data-run="${esc(runId)}"`, 'btn small secondary');
    return `<div class="chg-run"><div class="row">${esc(runId)} ${revert}</div><ul>${rows.join('')}</ul></div>`;
  });
  const dk = 'changes';
  return `<details class="changes" data-dk="${dk}"${isOpen(dk, true) ? ' open' : ''}><summary>Applied changes (${state.changes.length})</summary>${groups.join('')}</details>`;
}

// ---------- item trees ----------

function threadItem(t: ThreadInfo, entries: Entry[], runId: string): Item {
  const dk = `thr:${runId}:${t.id}`;
  return {
    key: `th:${t.id}`,
    sig: `${t.title}|${t.status}`,
    html: `<span class="title">${esc(t.title)}</span>${badge(t.status)}`,
    open: isOpen(dk, true),
    children: entries.map(entryItem),
  };
}

const entryItem = (e: Entry): Item => ({ key: e.key, sig: JSON.stringify(e), html: entryHtml(e) });

/** Top-level timeline: entries in order, with thread groups placed at their first entry. */
export function timelineItems(run: Run): Item[] {
  const known = new Set(run.threads.map((t) => t.id));
  const items: Item[] = [];
  const emitted = new Set<string>();
  const emit = (t: ThreadInfo): void => {
    emitted.add(t.id);
    items.push(
      threadItem(
        t,
        run.entries.filter((e) => e.threadId === t.id),
        run.runId,
      ),
    );
  };
  for (const e of run.entries) {
    const t = known.has(e.threadId) ? run.threads.find((x) => x.id === e.threadId) : undefined;
    if (!t) items.push(entryItem(e));
    else if (!emitted.has(t.id)) emit(t);
  }
  run.threads.filter((t) => !emitted.has(t.id)).forEach(emit);
  return items;
}

function runItems(run: Run, isLatest: boolean): Item[] {
  const ctx = contextHtml(run, isLatest);
  const list: Item[] = [{ key: 'user', sig: run.prompt, html: `<div class="user">${esc(run.prompt)}</div>` }];
  if (ctx) list.push({ key: 'ctx', sig: ctx, html: ctx });
  list.push(...timelineItems(run));
  const foot = footerHtml(run);
  if (foot) list.push({ key: 'footer', sig: foot, html: foot });
  return list;
}

// ---------- DOM patching ----------

function makeNode(item: Item): HTMLElement {
  const el = document.createElement(item.children ? 'details' : 'div') as HTMLDetailsElement;
  el.dataset.key = item.key;
  if (!item.children) return el;
  el.className = 'thread';
  el.dataset.dk = `thr:${item.key}`;
  if (item.children) el.open = item.open ?? true;
  el.innerHTML = '<summary></summary><div class="body"></div>';
  return el;
}

function patchNode(el: HTMLElement, item: Item): void {
  if (el.dataset.sig !== item.sig) {
    el.dataset.sig = item.sig;
    const target = item.children ? el.querySelector('summary') : el;
    if (target) target.innerHTML = item.html;
  }
  const body = item.children ? el.querySelector<HTMLElement>(':scope > .body') : null;
  if (body && item.children) syncChildren(body, item.children);
}

/** Reconcile `container`'s keyed children with `items` (create, patch, reorder, remove). */
export function syncChildren(container: HTMLElement, items: Item[]): void {
  const existing = new Map<string, HTMLElement>();
  for (const child of Array.from(container.children) as HTMLElement[]) {
    if (child.dataset.key) existing.set(child.dataset.key, child);
  }
  items.forEach((item, i) => {
    const el = existing.get(item.key) ?? makeNode(item);
    existing.delete(item.key);
    patchNode(el, item);
    if (container.children[i] !== el) container.insertBefore(el, container.children[i] ?? null);
  });
  existing.forEach((el) => el.remove());
}

export interface Refs {
  root: HTMLElement;
  transcript: HTMLElement;
  notices: HTMLElement;
  changes: HTMLElement;
  chip: HTMLElement;
  dot: HTMLElement;
  send: HTMLButtonElement;
  input: HTMLTextAreaElement;
  mentions: HTMLElement;
  empty: HTMLElement;
}

const iconBtn = (action: string, label: string, glyph: string): string =>
  `<button type="button" class="icon" data-action="${action}" aria-label="${label}" title="${label}">${glyph}</button>`;

const EMPTY_HINT = `<h3>Anvil</h3><p>Describe a change. Anvil gathers the relevant code, edits it with your review, and shows exactly what context it used.</p>
<ul><li>Add a --verbose flag to the flask routes command</li><li>Why does @app.errorhandler not catch 404s here?</li><li>Rename get_debug_flag to is_debug and update callers</li></ul>`;

export function mount(root: HTMLElement): Refs {
  root.innerHTML = `<header class="header"><span class="dot" id="dot" role="img" aria-label="Health unknown"></span><span class="chip" id="chip"></span><span class="spacer"></span>
${iconBtn('newChat', 'New chat', '＋')}${iconBtn('doctor', 'Doctor', '⚕')}${iconBtn('openSession', 'Open in TrueForge', '↗')}</header>
<div id="notices"></div>
<main id="transcript" class="transcript" role="log" aria-live="polite"><div class="empty" id="empty">${EMPTY_HINT}</div></main>
<div id="changes"></div>
<footer class="composer"><div id="mentions" class="mentions" role="listbox" hidden></div>
<textarea id="input" rows="1" aria-label="Message" placeholder="Ask Anvil to change your code… (@ to mention files or symbols)"></textarea>
<button type="button" id="send" class="btn primary" data-action="send">Send</button></footer>`;
  const q = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`) as T;
  return {
    root,
    transcript: q('transcript'),
    notices: q('notices'),
    changes: q('changes'),
    chip: q('chip'),
    dot: q('dot'),
    send: q('send'),
    input: q('input'),
    mentions: q('mentions'),
    empty: q('empty'),
  };
}

const HEALTH_COLOR = { ok: 'ok', down: 'down', unknown: 'unknown' } as const;

function renderHeader(refs: Refs, s: PanelState): void {
  refs.chip.textContent = s.activeModel || 'no model';
  refs.chip.title = s.models.length ? `Model chain: ${s.models.join(' → ')}` : 'Model chain unavailable';
  const h = s.health;
  const state = h ? HEALTH_COLOR[h.trueforge] : 'unknown';
  refs.dot.className = `dot ${state}`;
  const tip = h
    ? `TrueForge ${h.trueforge}, bridge ${h.bridge}, ${h.indexedFiles} files indexed`
    : 'TrueForge status unknown';
  refs.dot.title = tip;
  refs.dot.setAttribute('aria-label', tip);
}

function renderNotices(refs: Refs, notices: GlobalNotice[]): void {
  const items = notices.map((n) => ({
    key: n.key,
    sig: JSON.stringify(n),
    html: noticeHtml(n.level, n.message, n.actions),
  }));
  syncChildren(refs.notices, items);
}

/** Re-render the whole panel from state; scrolls only when the user was already near the bottom. */
export function render(refs: Refs, s: PanelState): void {
  const t = refs.transcript;
  const nearBottom = t.scrollHeight - t.scrollTop - t.clientHeight < 60;
  renderHeader(refs, s);
  renderNotices(refs, s.notices);
  refs.empty.hidden = s.runs.length > 0;
  const runs: Item[] = s.runs.map((run, i) => ({
    key: `run:${run.runId}`,
    sig: '',
    html: '',
    children: runItems(run, i === s.runs.length - 1),
    open: true,
  }));
  syncRuns(t, runs);
  const changes = changesHtml(s);
  refs.changes.innerHTML = changes;
  refs.send.textContent = s.running ? 'Stop' : 'Send';
  refs.send.dataset.action = s.running ? 'cancel' : 'send';
  refs.send.classList.toggle('stop', s.running);
  // Stop must always be clickable; Send only with text (the input handler covers typing).
  refs.send.disabled = !s.running && refs.input.value.trim() === '';
  if (nearBottom) t.scrollTop = t.scrollHeight;
}

/** Runs are plain containers (not <details>) so they are synced with their own wrapper class. */
function syncRuns(transcript: HTMLElement, runs: Item[]): void {
  const empty = transcript.querySelector('#empty');
  const wrap = transcript.querySelector<HTMLElement>('#runs') ?? createRunsWrap(transcript, empty);
  const existing = new Map<string, HTMLElement>();
  for (const c of Array.from(wrap.children) as HTMLElement[]) existing.set(c.dataset.key ?? '', c);
  runs.forEach((r, i) => {
    let el = existing.get(r.key);
    if (!el) {
      el = document.createElement('section');
      el.className = 'run';
      el.dataset.key = r.key;
    }
    existing.delete(r.key);
    syncChildren(el, r.children ?? []);
    if (wrap.children[i] !== el) wrap.insertBefore(el, wrap.children[i] ?? null);
  });
  existing.forEach((el) => el.remove());
}

function createRunsWrap(transcript: HTMLElement, before: Element | null): HTMLElement {
  const wrap = document.createElement('div');
  wrap.id = 'runs';
  transcript.insertBefore(wrap, before ? before.nextSibling : null);
  return wrap;
}
