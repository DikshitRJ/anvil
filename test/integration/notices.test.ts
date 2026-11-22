// Regression for issue #78: drives the real RunController's panel-message handling into the real webview reducer,
// including the persist -> reload round trip, to check the global notice lifecycle end to end on the host side.
import { describe, expect, it, vi } from 'vitest';
import type { HostToWebview } from '../../src/panel/protocol';
import { type PanelState, dismissNotice, hydrate, initialState, persistable, reduce } from '../../webview/state';

// RunController imports 'vscode' but only touches it when a run or file action happens, never on the paths used here.
vi.mock('vscode', () => ({}));
const { RunController } = await import('../../src/host/runController');
type Deps = ConstructorParameters<typeof RunController>[0];

const DOCTOR_OK: HostToWebview = {
  type: 'notice',
  id: 'doctor',
  level: 'info',
  message: 'Anvil Doctor: all checks passed',
};

/** A RunController whose posts feed a webview state, with a Doctor that posts its singleton notice like extension.ts. */
function harness() {
  let state: PanelState = initialState();
  const posted: HostToWebview[] = [];
  const post = (m: HostToWebview): void => {
    posted.push(m);
    state = reduce(state, m);
  };
  const noop = (): void => undefined;
  const deps = {
    root: '/ws',
    getConfig: () => ({ models: [] }),
    post,
    initMessage: () => ({ type: 'init', models: [], activeModel: '', trueforgeUrl: 'http://tf' }),
    healthMessage: () => ({ type: 'health', trueforge: 'ok', bridge: 'ok', indexedFiles: 0 }),
    runDoctor: () => post(DOCTOR_OK),
    log: noop,
    review: { cancelAll: noop },
    commands: { killAll: noop },
  } as unknown as Deps;
  const rc = new RunController(deps);
  return {
    rc,
    posted,
    get state() {
      return state;
    },
    set state(s: PanelState) {
      state = s;
    },
  };
}

describe('global notice lifecycle (host -> webview)', () => {
  it('repeated Doctor runs keep a single banner', () => {
    const h = harness();
    h.rc.onPanelMessage({ type: 'ready' });
    for (let i = 0; i < 4; i++) h.rc.onPanelMessage({ type: 'doctor' });
    // The "Run Doctor" notice action reaches the same singleton.
    h.rc.onPanelMessage({ type: 'notice-action', action: 'Run Doctor' });
    expect(h.posted.filter((m) => m.type === 'notice')).toHaveLength(5);
    expect(h.state.notices).toHaveLength(1);
    expect(h.state.notices[0]?.message).toBe('Anvil Doctor: all checks passed');
  });

  it('repeated identical host notices (no models configured) do not stack', async () => {
    const h = harness();
    await h.rc.startRun('one');
    await h.rc.startRun('two');
    expect(h.state.notices).toEqual([
      expect.objectContaining({ level: 'error', message: 'No models configured. Set anvil.models.' }),
    ]);
  });

  it('New Chat from the panel clears global notices', async () => {
    const h = harness();
    h.rc.onPanelMessage({ type: 'doctor' });
    await h.rc.startRun('x');
    expect(h.state.notices).toHaveLength(2);
    h.rc.onPanelMessage({ type: 'newChat' });
    expect(h.posted.at(-1)).toEqual({ type: 'chatReset' });
    expect(h.state.notices).toEqual([]);
  });

  it('New Chat from the command (anvil.newChat -> RunController.newChat) clears global notices', () => {
    const h = harness();
    h.rc.onPanelMessage({ type: 'doctor' });
    h.rc.newChat();
    expect(h.state.notices).toEqual([]);
  });

  it('a dismissed banner stays gone; a later notice shows again', () => {
    const h = harness();
    h.rc.onPanelMessage({ type: 'doctor' });
    h.state = dismissNotice(h.state, h.state.notices[0]?.key ?? '');
    expect(h.state.notices).toEqual([]);
    h.rc.onPanelMessage({ type: 'doctor' });
    expect(h.state.notices).toHaveLength(1);
  });

  it('a webview reload does not resurrect notices from saved state', () => {
    const h = harness();
    h.rc.onPanelMessage({ type: 'ready' });
    h.rc.onPanelMessage({ type: 'doctor' });
    // What main.ts writes with vscode.setState() and reads back with vscode.getState() on re-creation.
    const saved = JSON.parse(JSON.stringify({ state: persistable(h.state) })) as unknown;
    h.state = hydrate(saved);
    expect(h.state.notices).toEqual([]);
    // The reloaded webview sends 'ready' again; init/health come back but no stale banner.
    h.rc.onPanelMessage({ type: 'ready' });
    expect(h.state.notices).toEqual([]);
    expect(h.state.trueforgeUrl).toBe('http://tf');
  });
});
