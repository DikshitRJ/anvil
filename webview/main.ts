// Webview entry: wires host messages -> reducer -> render, and DOM events -> typed WebviewToHost messages.
import type { HostToWebview, WebviewToHost } from '../src/panel/protocol';
import { type Refs, mount, recordToggle, render } from './render';
import { type PanelState, initialState, reduce } from './state';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const post = (m: WebviewToHost): void => vscode.postMessage(m);
const MAX_RUNS = 20;

function restore(): PanelState {
  const saved = vscode.getState() as { state?: PanelState } | undefined;
  const s = saved?.state;
  if (!s || !Array.isArray(s.runs)) return initialState();
  return { ...initialState(), ...s, running: false, mentions: undefined };
}

let state = restore();
const refs: Refs = mount(document.getElementById('app') as HTMLElement);
let mentionTimer: ReturnType<typeof setTimeout> | undefined;
let mentionIndex = 0;

function persist(): void {
  vscode.setState({ state: { ...state, runs: state.runs.slice(-MAX_RUNS) } });
}

function update(next: PanelState): void {
  state = next;
  render(refs, state);
  renderMentions();
  persist();
}

// ---------- composer ----------

const TOKEN = /(^|\s)(@[^\s@]*)$/;
function currentToken(): { token: string; start: number } | undefined {
  const pos = refs.input.selectionStart;
  const m = TOKEN.exec(refs.input.value.slice(0, pos));
  if (!m || m[2] === undefined) return undefined;
  return { token: m[2], start: pos - m[2].length };
}

function autoGrow(): void {
  const lineHeight = parseFloat(getComputedStyle(refs.input).lineHeight) || 18;
  refs.input.style.height = 'auto';
  refs.input.style.height = `${Math.min(refs.input.scrollHeight, lineHeight * 8)}px`;
  refs.send.disabled = !state.running && refs.input.value.trim() === '';
}

function sendMessage(): void {
  const text = refs.input.value.trim();
  if (!text || state.running) return;
  post({ type: 'send', text });
  refs.input.value = '';
  autoGrow();
}

function queryMentions(): void {
  clearTimeout(mentionTimer);
  const tok = currentToken();
  if (!tok) {
    state = { ...state, mentions: undefined };
    renderMentions();
    return;
  }
  mentionTimer = setTimeout(() => post({ type: 'mentionQuery', query: tok.token }), 120);
}

function visibleMentions(): NonNullable<PanelState['mentions']>['items'] {
  const tok = currentToken();
  if (!tok || !state.mentions || state.mentions.query !== tok.token) return [];
  return state.mentions.items;
}

function renderMentions(): void {
  const items = visibleMentions();
  refs.mentions.hidden = items.length === 0;
  mentionIndex = Math.min(mentionIndex, Math.max(0, items.length - 1));
  refs.mentions.replaceChildren(
    ...items.map((it, i) => {
      const row = document.createElement('div');
      row.className = `mention${i === mentionIndex ? ' active' : ''}`;
      row.setAttribute('role', 'option');
      row.dataset.index = String(i);
      row.textContent = `${it.kind === 'file' ? '📄' : 'ƒ'} ${it.label}  ${it.detail}`;
      return row;
    }),
  );
}

function insertMention(i: number): void {
  const item = visibleMentions()[i];
  const tok = currentToken();
  if (!item || !tok) return;
  const v = refs.input.value;
  const end = refs.input.selectionStart;
  refs.input.value = `${v.slice(0, tok.start)}${item.insert} ${v.slice(end)}`;
  const caret = tok.start + item.insert.length + 1;
  refs.input.setSelectionRange(caret, caret);
  state = { ...state, mentions: undefined };
  renderMentions();
  autoGrow();
}

/** Returns true when the key was consumed by the mention dropdown. */
function mentionKey(e: KeyboardEvent): boolean {
  const items = visibleMentions();
  if (items.length === 0) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const d = e.key === 'ArrowDown' ? 1 : -1;
    mentionIndex = (mentionIndex + d + items.length) % items.length;
    renderMentions();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    insertMention(mentionIndex);
  } else if (e.key === 'Escape') {
    state = { ...state, mentions: undefined };
    renderMentions();
  } else return false;
  return true;
}

refs.input.addEventListener('keydown', (e) => {
  if (e.isComposing || mentionKey(e)) return e.preventDefault();
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  } else if (e.key === 'Escape' && state.running) post({ type: 'cancel' });
});
refs.input.addEventListener('input', () => {
  autoGrow();
  mentionIndex = 0;
  queryMentions();
});
refs.input.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') queryMentions();
});
refs.mentions.addEventListener('mousedown', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
  if (!row) return;
  e.preventDefault();
  insertMention(Number(row.dataset.index));
});

// ---------- delegated actions ----------

type Handler = (el: HTMLElement) => WebviewToHost | undefined;
const ACTIONS: Record<string, Handler> = {
  send: () => (sendMessage(), undefined),
  cancel: () => ({ type: 'cancel' }),
  newChat: () => ({ type: 'newChat' }),
  doctor: () => ({ type: 'doctor' }),
  openSession: () => ({ type: 'openSession' }),
  approve: (el) => ({ type: 'approve', id: el.dataset.id ?? '', allow: el.dataset.allow === '1' }),
  openFile: (el) => ({
    type: 'openFile',
    path: el.dataset.path ?? '',
    ...(el.dataset.line ? { line: Number(el.dataset.line) } : {}),
  }),
  undoChange: (el) => ({ type: 'undoChange', seq: Number(el.dataset.seq) }),
  revertRun: (el) => ({ type: 'revertRun', runId: el.dataset.run ?? '' }),
  'notice-action': (el) => ({ type: 'notice-action', action: el.dataset.value ?? '' }),
};

refs.root.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const msg = ACTIONS[el.dataset.action ?? '']?.(el);
  if (msg) post(msg);
});
refs.root.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (e.key === 'Enter' && el.matches('a[data-action]')) el.click();
});
refs.root.addEventListener(
  'toggle',
  (e) => {
    const d = e.target as HTMLDetailsElement;
    if (d.dataset.dk) recordToggle(d.dataset.dk, d.open);
  },
  true,
);

window.addEventListener('message', (e: MessageEvent<HostToWebview>) => update(reduce(state, e.data)));

render(refs, state);
autoGrow();
post({ type: 'ready' });
