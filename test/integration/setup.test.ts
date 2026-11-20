import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, checkHealth } from '../../src/trueforge/client';
import { ensureSetup } from '../../src/trueforge/setup';
import { loadAgentDefinitions } from '../../src/trueforge/spec';
import { MockTrueForge } from '../helpers/mockTrueForge';

let mock: MockTrueForge;
let url: string;

beforeEach(async () => {
  mock = new MockTrueForge();
  url = await mock.start();
});
afterEach(() => mock.stop());

describe('ensureSetup', () => {
  const opts = () => {
    const { coder, inline } = loadAgentDefinitions();
    return { mcpUrl: 'http://127.0.0.1:9/mcp', token: 'tok', agents: [coder, inline], models: ['mock/mock-coder'] };
  };

  it('registers the MCP server with header auth and creates then updates agents', async () => {
    const client = createClient(url);
    const first = await ensureSetup(client, opts());
    expect(first).toEqual({ mcpServer: 'created', agents: { 'anvil-coder': 'ok', 'anvil-inline': 'ok' }, errors: [] });
    expect(mock.find('PUT', '/settings/mcp-servers')[0]?.body.manifest).toMatchObject({
      type: 'remote',
      name: 'anvil-editor',
      url: 'http://127.0.0.1:9/mcp',
      auth: { type: 'header', headers: { Authorization: 'Bearer tok' } },
    });
    expect(mock.find('POST', '/agents')).toHaveLength(2);
    expect(mock.find('POST', '/agents')[0]?.body.manifest.mcp_servers[0].enable_tools).toEqual(['@all']);

    const second = await ensureSetup(client, opts());
    expect(second.mcpServer).toBe('updated');
    expect(mock.find('POST', '/agents')).toHaveLength(2);
    expect(mock.find('PUT', '/agents/')).toHaveLength(2);
  });

  it('substitutes the first configured model into each agent manifest', async () => {
    await ensureSetup(createClient(url), { ...opts(), models: ['a/first', 'b/second'] });
    const sent = mock.find('POST', '/agents').map((r) => r.body.manifest.model.name);
    expect(sent).toEqual(['a/first', 'a/first']);
  });

  it('skips agent registration when no models are configured', async () => {
    const report = await ensureSetup(createClient(url), { ...opts(), models: [] });
    expect(report.agents).toEqual({ 'anvil-coder': 'failed', 'anvil-inline': 'failed' });
    expect(report.errors).toContain('agent anvil-coder: Set anvil.models to register agents');
    expect(mock.find('POST', '/agents')).toHaveLength(0);
    expect(mock.find('PUT', '/agents/')).toHaveLength(0);
  });

  it('collects errors instead of throwing', async () => {
    const dead = new MockTrueForge();
    const deadUrl = await dead.start();
    await dead.stop();
    const report = await ensureSetup(createClient(deadUrl), opts());
    expect(report.mcpServer).toBe('failed');
    expect(Object.values(report.agents)).toEqual(['failed', 'failed']);
    expect(report.errors).toHaveLength(3);
  });
});

describe('checkHealth', () => {
  it('is true for a live server and false (not throwing) for a dead one', async () => {
    expect(await checkHealth(url)).toBe(true);
    await mock.stop();
    expect(await checkHealth(url, 300)).toBe(false);
    mock = new MockTrueForge();
    url = await mock.start();
  });
});
