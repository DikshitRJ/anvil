// Composition root: wires index, MCP bridge, TrueForge client, run controller, panel, review, inline edit and commands.
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { AnvilConfig } from './core/config';
import { toRelative } from './core/paths';
import { CommandRunner } from './host/commandRunner';
import { onConfigChange, readConfig } from './host/config';
import { formatReport, runChecks } from './host/doctor';
import { HealthLoop } from './host/healthLoop';
import { IndexService } from './host/indexService';
import { cancelActiveInlineEdit, registerInlineEdit } from './host/inlineEdit';
import { ReviewController } from './host/reviewController';
import { RunController } from './host/runController';
import { AnvilStatusBar } from './host/statusBar';
import { VsCodeWorkspaceHost } from './host/workspaceHost';
import { startBridge } from './mcp/server';
import { PanelProvider } from './panel/panelProvider';
import type { HostToWebview } from './panel/protocol';
import { checkHealth, createClient } from './trueforge/client';
import { ensureSetup } from './trueforge/setup';
import { loadAgentDefinitions } from './trueforge/spec';

type Bridge = Awaited<ReturnType<typeof startBridge>>;

const COMMANDS = [
  'anvil.cancel',
  'anvil.newChat',
  'anvil.setup',
  'anvil.doctor',
  'anvil.undoLast',
  'anvil.openSession',
  'anvil.focusPanel',
];

let bridge: Bridge | undefined;
let disposeAll: (() => void) | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('Anvil');
  context.subscriptions.push(output);
  const log = (m: string): void => output.appendLine(`[${new Date().toISOString()}] ${m}`);
  try {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) registerNoFolder(context);
    else await boot(context, root, log);
    log('Anvil activated');
  } catch (e) {
    log(`activation error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    registerMissing(context);
    void vscode.window.showErrorMessage(`Anvil failed to start: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function deactivate(): Promise<void> {
  disposeAll?.();
  await bridge?.close().catch(() => undefined);
  bridge = undefined;
}

function register(context: vscode.ExtensionContext, id: string, fn: () => unknown): void {
  context.subscriptions.push(vscode.commands.registerCommand(id, fn));
}

/** Registers any contributed command that is not yet registered so the palette never shows dead entries. */
function registerMissing(context: vscode.ExtensionContext): void {
  void vscode.commands.getCommands(true).then((have) => {
    for (const id of [...COMMANDS, 'anvil.inlineEdit']) {
      if (!have.includes(id)) {
        register(context, id, () => {
          void vscode.window.showWarningMessage('Anvil is not available (see the Anvil output channel).');
        });
      }
    }
  });
}

function registerNoFolder(context: vscode.ExtensionContext): void {
  // Fire-and-forget: returning the toast promise would block executeCommand until it is dismissed.
  const show = (): void => void vscode.window.showInformationMessage('Open a folder to use Anvil');
  for (const id of [...COMMANDS, 'anvil.inlineEdit']) register(context, id, show);
}

async function getToken(context: vscode.ExtensionContext): Promise<string> {
  const existing = await context.secrets.get('anvil.mcpToken');
  if (existing) return existing;
  const token = randomBytes(32).toString('hex');
  await context.secrets.store('anvil.mcpToken', token);
  return token;
}

async function boot(context: vscode.ExtensionContext, root: string, log: (m: string) => void): Promise<void> {
  let cfg = readConfig();
  let client: TrueForge = createClient(cfg.trueforgeUrl);
  const defs = loadAgentDefinitions();
  const token = await getToken(context);
  const statusBar = new AnvilStatusBar();
  statusBar.setConfig(cfg.models, cfg.trueforgeUrl);
  const commands = new CommandRunner();
  const review = new ReviewController(context);
  let health: 'ok' | 'down' | 'unknown' = 'unknown';
  // 'elsewhere' = port held by another VS Code window. Limitation: only one window serves agent tools per port.
  let bridgeState: 'ok' | 'elsewhere' | 'failed' = 'failed';

  const indexSvc = new IndexService(
    root,
    (s) => {
      statusBar.setIndexing(s.ready ? undefined : s.files);
      panel.post(healthMsg());
    },
    log,
  );
  const panel: PanelProvider = new PanelProvider(context.extensionUri, (m) => run.onPanelMessage(m));
  const healthMsg = (): HostToWebview => ({
    type: 'health',
    trueforge: health,
    bridge: bridgeState === 'failed' ? 'down' : 'ok',
    indexedFiles: indexSvc.index.files().length,
  });
  const initMsg = (): HostToWebview => ({
    type: 'init',
    models: cfg.models,
    activeModel: cfg.models[0] ?? '',
    trueforgeUrl: cfg.trueforgeUrl,
  });

  const doctor = async (): Promise<void> => {
    const checks = await runChecks({
      cfg,
      client,
      bridgeUrl: bridge?.url,
      bridgeState,
      token,
      indexedFiles: indexSvc.index.files().length,
      indexReady: indexSvc.ready,
    });
    const chan = vscode.window.createOutputChannel('Anvil Doctor');
    chan.clear();
    chan.appendLine(formatReport(checks));
    chan.show(true);
    const bad = checks.filter((c) => !c.ok);
    const summary = bad.length
      ? `Anvil Doctor: ${bad.length} problem(s) — ${bad.map((c) => c.name).join(', ')}`
      : 'Anvil Doctor: all checks passed';
    panel.post({ type: 'notice', level: bad.length ? 'warn' : 'info', message: summary });
    const needsSetup = bad.some((c) => c.setup);
    const pick = bad.length
      ? await vscode.window.showWarningMessage(summary, ...(needsSetup ? ['Run setup'] : []))
      : await vscode.window.showInformationMessage(summary);
    if (pick === 'Run setup') await vscode.commands.executeCommand('anvil.setup');
  };

  const run: RunController = new RunController({
    root,
    getConfig: () => cfg,
    getClient: () => client,
    getAgents: () => defs,
    getIndex: () => ({ index: indexSvc.index, ready: indexSvc.ready }),
    readFile: (rel) => host.readFile(rel),
    review,
    commands,
    statusBar,
    post: (m) => panel.post(m),
    initMessage: initMsg,
    healthMessage: healthMsg,
    runDoctor: () => void doctor(),
    log,
  });
  const host: VsCodeWorkspaceHost = new VsCodeWorkspaceHost(root, () => indexSvc.index, {
    applyWrite: (rel, content, summary) => run.applyWrite(rel, content, summary),
    runCommand: (c, o) => run.runCommand(c, o),
  });

  const setup = async (): Promise<void> => {
    // An 'elsewhere' window must not re-register: it would overwrite the URL set by the owning window.
    if (bridgeState === 'elsewhere') return;
    if (!bridge)
      return void vscode.window.showErrorMessage('Anvil: MCP bridge is not running; cannot register it in TrueForge.');
    try {
      const report = await ensureSetup(client, {
        mcpUrl: bridge.url,
        token,
        agents: [defs.coder, defs.inline],
        models: cfg.models,
      });
      log(`setup report: ${JSON.stringify(report)}`);
      if (report.errors.length)
        void vscode.window.showErrorMessage(`Anvil setup problems: ${report.errors.join('; ')}`);
    } catch (e) {
      log(`setup failed: ${String(e)}`);
      void vscode.window.showErrorMessage(`Anvil setup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  try {
    bridge = await startBridge({ host, gate: run, port: cfg.mcpPort, token });
    bridgeState = 'ok';
    log(`MCP bridge at ${bridge.url}`);
  } catch (e) {
    log(`bridge failed: ${String(e)}`);
    if (/EADDRINUSE|in use/i.test(e instanceof Error ? e.message : String(e))) {
      bridgeState = 'elsewhere';
      void vscode.window.showInformationMessage(
        `Anvil agent tools are served by another VS Code window (port ${cfg.mcpPort}). Inline edit works here; use the agent panel in that window or change anvil.mcpPort.`,
      );
    } else {
      void vscode.window.showErrorMessage(
        `Anvil MCP bridge failed to start: ${e instanceof Error ? e.message : String(e)}. Agent tools will not work.`,
      );
    }
  }

  const healthLoop = new HealthLoop(
    () => checkHealth(cfg.trueforgeUrl),
    (s) => {
      health = s;
      statusBar.setHealth(s === 'ok');
      panel.post(healthMsg());
    },
    () => void setup(),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelProvider.viewType, panel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.workspace.onDidSaveTextDocument((d) => {
      if (d.uri.scheme !== 'file') return;
      const rel = toRelative(root, d.uri.fsPath);
      if (!rel.startsWith('..')) run.trackSaved(rel);
    }),
    onConfigChange((next) => {
      const urlChanged = next.trueforgeUrl !== cfg.trueforgeUrl;
      const chainChanged =
        JSON.stringify([next.models, next.retriesPerModel, next.stallTimeoutSec]) !==
        JSON.stringify([cfg.models, cfg.retriesPerModel, cfg.stallTimeoutSec]);
      cfg = next;
      if (urlChanged) client = createClient(cfg.trueforgeUrl);
      if (urlChanged || chainChanged) run.resetSessionIfIdle();
      statusBar.setConfig(cfg.models, cfg.trueforgeUrl);
      panel.post(initMsg());
      if (urlChanged) void healthLoop.tick();
    }),
    review,
    statusBar,
    commands,
    indexSvc,
    healthLoop,
  );

  registerInlineEdit(context, {
    review,
    getIndex: () => (indexSvc.ready ? indexSvc.index : undefined),
    createSession: () => inlineSession(run, defs.inline, cfg),
    applyAccepted: (p, b, a, s) => run.applyStandalone(p, b, a, s),
    log,
  });
  registerCommands(context, { run, setup, doctor, panel, cfg: () => cfg });
  indexSvc.start();
  healthLoop.start();
  disposeAll = () => run.dispose();
}

function inlineSession(run: RunController, agent: Parameters<RunController['newSession']>[0], cfg: AnvilConfig) {
  if (cfg.models.length === 0) {
    void vscode.window
      .showErrorMessage('Set anvil.models to use inline edit.', 'Open Settings')
      .then((p) => p && vscode.commands.executeCommand('workbench.action.openSettings', 'anvil.models'));
    throw new Error('Set anvil.models');
  }
  return run.newSession(agent, cfg, 'Anvil inline edit');
}

interface CommandCtx {
  run: RunController;
  setup(): Promise<void>;
  doctor(): Promise<void>;
  panel: PanelProvider;
  cfg(): AnvilConfig;
}

function registerCommands(context: vscode.ExtensionContext, c: CommandCtx): void {
  register(context, 'anvil.cancel', () => cancelActiveInlineEdit() || c.run.cancel());
  register(context, 'anvil.newChat', () => c.run.newChat());
  register(context, 'anvil.setup', () => c.setup());
  register(context, 'anvil.doctor', () => c.doctor());
  register(context, 'anvil.undoLast', () => c.run.undoLast());
  register(context, 'anvil.focusPanel', () => vscode.commands.executeCommand('anvil.panel.focus'));
  register(context, 'anvil.openSession', () => {
    const id = c.run.sessionId;
    if (!id) return void vscode.window.showInformationMessage('Anvil: no session yet. Send a message first.');
    return vscode.env.openExternal(vscode.Uri.parse(`${c.cfg().trueforgeUrl}/sessions/${id}`));
  });
}
