// Doctor: checks TrueForge, the MCP bridge, registrations, models and the index; writes a report. Never throws.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TrueForge } from '@truefoundry/trueforge-sdk';
import type { AnvilConfig } from '../core/config';
import { checkHealth } from '../trueforge/client';
import { MCP_SERVER_NAME } from '../trueforge/setup';

export interface DoctorDeps {
  cfg: AnvilConfig;
  client: TrueForge;
  bridgeUrl: string | undefined;
  /** 'elsewhere': another VS Code window owns the port (EADDRINUSE); not a failure. */
  bridgeState?: 'ok' | 'elsewhere' | 'failed';
  token: string;
  indexedFiles: number;
  indexReady: boolean;
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
  /** True when "Run setup" would fix it. */
  setup?: boolean;
  /** Passing, but worth a hint (shown as a warning sign). */
  warn?: boolean;
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function guard(name: string, fn: () => Promise<Omit<Check, 'name'>>): Promise<Check> {
  try {
    return { name, ...(await fn()) };
  } catch (e) {
    return { name, ok: false, detail: msg(e) };
  }
}

async function checkTrueForge(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  const ok = await checkHealth(d.cfg.trueforgeUrl);
  return ok
    ? { ok, detail: `reachable at ${d.cfg.trueforgeUrl}` }
    : {
        ok,
        detail: `no response from ${d.cfg.trueforgeUrl}`,
        fix: 'Start TrueForge (npm run setup:trueforge) or fix anvil.trueforgeUrl.',
      };
}

const ELSEWHERE_FIX = 'Use the agent panel in the owning window, or change anvil.mcpPort.';

async function checkBridge(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  if (d.bridgeState === 'elsewhere')
    return {
      ok: true,
      warn: true,
      detail: `served by another VS Code window (port ${d.cfg.mcpPort}); inline edit works here`,
      fix: ELSEWHERE_FIX,
    };
  if (!d.bridgeUrl)
    return {
      ok: false,
      detail: 'bridge not running',
      fix: `Check that port ${d.cfg.mcpPort} is free (anvil.mcpPort) and reload.`,
    };
  const client = new Client({ name: 'anvil-doctor', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(d.bridgeUrl), {
    requestInit: { headers: { Authorization: `Bearer ${d.token}` } },
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const ok = tools.length >= 10;
    const detail = `listening at ${d.bridgeUrl}, ${tools.length} tools`;
    return ok ? { ok, detail } : { ok, detail, fix: 'Unexpected tool count; reinstall the extension.' };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function checkRegistered(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  if (d.bridgeState === 'elsewhere')
    return { ok: true, warn: true, detail: 'managed by the window that owns the bridge', fix: ELSEWHERE_FIX };
  const res = await d.client.settings.mcpServers.get(MCP_SERVER_NAME);
  const url = (res.data.manifest as { url?: string }).url;
  const ok = !!d.bridgeUrl && url === d.bridgeUrl;
  return ok
    ? { ok, detail: `${MCP_SERVER_NAME} -> ${url}` }
    : {
        ok,
        detail: `registered url is ${url ?? '(none)'}, bridge is ${d.bridgeUrl ?? '(down)'}`,
        fix: 'Run setup.',
        setup: true,
      };
}

async function checkAgents(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  const names: string[] = [];
  for await (const a of await d.client.agents.list({})) names.push(a.name);
  const missing = ['anvil-coder', 'anvil-inline'].filter((n) => !names.includes(n));
  return missing.length === 0
    ? { ok: true, detail: 'anvil-coder and anvil-inline registered' }
    : { ok: false, detail: `missing: ${missing.join(', ')}`, fix: 'Run setup.', setup: true };
}

async function checkModels(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  if (d.cfg.models.length === 0)
    return {
      ok: false,
      detail: 'anvil.models is empty',
      fix: 'Set anvil.models to model names configured in TrueForge.',
    };
  const available = (await d.client.models.list()).data;
  const known = new Set(available.flatMap((m) => [m.name, m.modelId]));
  const missing = d.cfg.models.filter((m) => !known.has(m));
  if (missing.length === 0) return { ok: true, detail: `${d.cfg.models.length} model(s) available in TrueForge` };
  const names =
    available
      .map((m) => m.name)
      .slice(0, 20)
      .join(', ') || '(none)';
  return {
    ok: false,
    detail: `not found in TrueForge: ${missing.join(', ')}. Available: ${names}`,
    fix: 'Fix anvil.models or add the provider in TrueForge.',
  };
}

function checkIndex(d: DoctorDeps): Promise<Omit<Check, 'name'>> {
  return Promise.resolve({
    ok: d.indexReady && d.indexedFiles > 0,
    detail: d.indexReady ? `${d.indexedFiles} files indexed` : `still building (${d.indexedFiles} files so far)`,
  });
}

export async function runChecks(d: DoctorDeps): Promise<Check[]> {
  const tf = await guard('TrueForge reachable', () => checkTrueForge(d));
  const rest = [
    guard('MCP bridge', () => checkBridge(d)),
    tf.ok
      ? guard('Bridge registered in TrueForge', () => checkRegistered(d))
      : skipped('Bridge registered in TrueForge'),
    tf.ok ? guard('Agents registered', () => checkAgents(d)) : skipped('Agents registered'),
    tf.ok ? guard('Models configured', () => checkModels(d)) : skipped('Models configured'),
    guard('Code index', () => checkIndex(d)),
  ];
  return [tf, ...(await Promise.all(rest))];
}

const skipped = (name: string): Promise<Check> =>
  Promise.resolve({ name, ok: false, detail: 'skipped (TrueForge unreachable)' });

export function formatReport(checks: Check[]): string {
  return checks
    .map(
      (c) =>
        `${c.ok ? (c.warn ? '⚠' : '✓') : '✗'} ${c.name}: ${c.detail}${(!c.ok || c.warn) && c.fix ? `\n    ${c.ok ? 'hint' : 'fix'}: ${c.fix}` : ''}`,
    )
    .join('\n');
}
