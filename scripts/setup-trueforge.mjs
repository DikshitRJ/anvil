#!/usr/bin/env node
/**
 * setup-trueforge.mjs: registers Anvil's model providers, editor MCP bridge and
 * agent definitions with a running TrueForge instance.
 *
 * Usage:
 *   npx @truefoundry/trueforge@latest                 # start TrueForge (another terminal)
 *   node scripts/setup-trueforge.mjs [path/to/config.json]
 *
 * The config defaults to config/trueforge.local.json. If that file is missing,
 * config/trueforge.example.json is used with a warning. ${ENV_VAR} placeholders in
 * string values are expanded from process.env. A provider that references an unset
 * variable is skipped with a warning.
 *
 * Optional environment:
 *   ANVIL_MCP_TOKEN  registers the editor MCP bridge. When unset, the extension
 *                    registers the bridge itself on activation.
 *   ANVIL_MCP_URL    bridge URL (default http://127.0.0.1:7801/mcp).
 *
 * Requires Node 20+ and @truefoundry/trueforge-sdk.
 *
 * Exit code: 1 when TrueForge is unreachable, 0 otherwise.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrueForge } from '@truefoundry/trueforge-sdk';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_CONFIG = resolve(ROOT, 'config/trueforge.local.json');
const EXAMPLE_CONFIG = resolve(ROOT, 'config/trueforge.example.json');
const AGENT_FILES = ['agent/anvil-coder.json', 'agent/anvil-inline.json'];
const ENV_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const DEFAULT_MCP_URL = 'http://127.0.0.1:7801/mcp';

const OUTBOUND_HINT = `hint: start TrueForge with OUTBOUND_URL_ALLOWED_HOSTS='["127.0.0.1","localhost"]' so it may call loopback addresses.`;
const BLOCKED_PATTERN = /outbound|blocked|network.?polic|allowed.?hosts/i;

const log = (msg) => console.log(msg);
const warn = (msg) => console.warn(`warning: ${msg}`);

function describe(err) {
  const status = err?.statusCode ? `HTTP ${err.statusCode}: ` : '';
  return `${status}${err instanceof Error ? err.message : String(err)}`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/** Reads the config from argv[2], or the local config, or the example config. */
async function loadConfig(argPath) {
  if (argPath) {
    const path = resolve(argPath);
    if (!existsSync(path)) throw new Error(`config not found: ${path}`);
    return readJson(path);
  }
  if (existsSync(LOCAL_CONFIG)) return readJson(LOCAL_CONFIG);
  warn('config/trueforge.local.json not found, using config/trueforge.example.json');
  return readJson(EXAMPLE_CONFIG);
}

/** Recursively expands ${VAR} in strings. Names of unset variables are pushed to `missing`. */
function expandEnv(node, missing) {
  if (typeof node === 'string') {
    return node.replace(ENV_PATTERN, (_, name) => {
      const value = process.env[name];
      if (value === undefined) {
        missing.push(name);
        return '';
      }
      return value;
    });
  }
  if (Array.isArray(node)) return node.map((item) => expandEnv(item, missing));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, expandEnv(v, missing)]));
  }
  return node;
}

/** Expands env placeholders and drops providers that reference unset variables. */
function resolveProviders(cfg) {
  const ready = [];
  for (const provider of cfg.modelProviders ?? []) {
    const missing = [];
    const manifest = expandEnv(provider, missing);
    if (missing.length > 0) {
      const names = [...new Set(missing)].join(', ');
      warn(`skipping provider ${provider.name}: unset environment variable(s) ${names}`);
      continue;
    }
    ready.push(manifest);
  }
  return ready;
}

/** Returns true when any HTTP response comes back from TrueForge, false on network errors. */
async function isReachable(url) {
  try {
    await fetch(`${url.replace(/\/$/, '')}/healthz`, { signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

/** Runs one registration step and logs ok or fail. Returns true on success. */
async function attempt(label, fn) {
  try {
    await fn();
    log(`  ok    ${label}`);
    return true;
  } catch (err) {
    log(`  fail  ${label}: ${describe(err)}`);
    if (BLOCKED_PATTERN.test(describe(err))) log(`        ${OUTBOUND_HINT}`);
    return false;
  }
}

async function registerProviders(client, providers) {
  const outcomes = [];
  for (const manifest of providers) {
    const label = `model provider ${manifest.name}`;
    outcomes.push(await attempt(label, () => client.settings.modelProviders.createOrUpdate({ manifest })));
  }
  return outcomes;
}

/** Registers the editor MCP bridge. The token is used but never printed. */
async function registerBridge(client, token) {
  const manifest = {
    type: 'remote',
    name: 'anvil-editor',
    url: process.env.ANVIL_MCP_URL ?? DEFAULT_MCP_URL,
    description: 'Anvil VS Code editor tools (read, search, review-gated edits, commands)',
    auth: { type: 'header', headers: { Authorization: `Bearer ${token}` } },
  };
  return attempt('mcp server anvil-editor', () => client.settings.mcpServers.createOrUpdate({ manifest }));
}

/** Loads one agent file and sets its model to the first configured model. */
async function loadAgent(file, defaultModel) {
  const def = await readJson(resolve(ROOT, file));
  const manifest = { ...def.manifest };
  if (defaultModel) manifest.model = { ...manifest.model, name: defaultModel };
  return { name: def.name, description: def.description, manifest };
}

async function findAgentId(client, name) {
  // The SDK's agents.list() returns an async-iterable Page; for await walks every page.
  for await (const agent of client.agents.list()) {
    if (agent.name === name) return agent.id;
  }
  return undefined;
}

/**
 * Updates the agent when one with the same name exists, otherwise creates it.
 * NOTE: request field names follow the SDK's documented surface (agents.update(id, { manifest }),
 * agents.create({ name, description, manifest })). Verify against node_modules/@truefoundry/trueforge-sdk.
 */
async function upsertAgent(client, agent) {
  return attempt(`agent ${agent.name}`, async () => {
    const id = await findAgentId(client, agent.name);
    if (id) {
      await client.agents.update(id, { manifest: agent.manifest });
    } else {
      await client.agents.create(agent);
    }
  });
}

async function registerAgents(client, defaultModel) {
  const outcomes = [];
  for (const file of AGENT_FILES) {
    try {
      const agent = await loadAgent(file, defaultModel);
      outcomes.push(await upsertAgent(client, agent));
    } catch (err) {
      log(`  fail  agent file ${file}: ${describe(err)}`);
      outcomes.push(false);
    }
  }
  return outcomes;
}

async function main() {
  const cfg = await loadConfig(process.argv[2]);
  const url = cfg.trueforgeUrl;
  if (!(await isReachable(url))) {
    console.error(`TrueForge not reachable at ${url} — start it with: npx @truefoundry/trueforge@latest`);
    process.exit(1);
  }

  const client = new TrueForge({ baseUrl: url, timeoutInSeconds: 30 });
  const models = cfg.models ?? [];
  const outcomes = [];

  log(`Registering with TrueForge at ${url}`);
  log(`  ${OUTBOUND_HINT}`);
  outcomes.push(...(await registerProviders(client, resolveProviders(cfg))));

  const token = process.env.ANVIL_MCP_TOKEN;
  if (token) {
    outcomes.push(await registerBridge(client, token));
  } else {
    log('  note  ANVIL_MCP_TOKEN not set: skipping the MCP bridge. The extension registers it on activation.');
  }

  outcomes.push(...(await registerAgents(client, models[0])));

  const succeeded = outcomes.filter(Boolean).length;
  log(`Done: ${succeeded}/${outcomes.length} registrations succeeded.`);
  log(`Suggested anvil.models setting: ${JSON.stringify(models)}`);
}

main().catch((err) => {
  console.error(describe(err));
  process.exit(1);
});
