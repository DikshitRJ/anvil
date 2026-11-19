import { describe, expect, it } from 'vitest';
import { serialization } from '@truefoundry/trueforge-sdk';
import coderJson from '../../agent/anvil-coder.json';
import inlineJson from '../../agent/anvil-inline.json';
import { buildSpec, loadAgentDefinitions, toSdkSpec } from '../../src/trueforge/spec';

describe('spec', () => {
  it('toSdkSpec camelCases keys but keeps model.params verbatim', () => {
    const spec = toSdkSpec({
      model: { name: 'a/b', params: { max_tokens: 5 } },
      mcp_servers: [{ name: 's', enable_tools: ['@all'], preload_tools: ['x'] }],
      config: { dynamic_sub_agents: { enabled: true } },
    });
    expect(spec).toEqual({
      model: { name: 'a/b', params: { max_tokens: 5 } },
      mcpServers: [{ name: 's', enableTools: ['@all'], preloadTools: ['x'] }],
      config: { dynamicSubAgents: { enabled: true } },
    });
  });

  it.each([
    ['coder', coderJson],
    ['inline', inlineJson],
  ])('round-trips %s through the SDK serializer back to the wire JSON', (which, json) => {
    const defs = loadAgentDefinitions();
    const def = which === 'coder' ? defs.coder : defs.inline;
    const wire = serialization.AgentSpec.jsonOrThrow(buildSpec(def, 'PLACEHOLDER/model'));
    expect(wire).toEqual(json.manifest);
  });

  it('buildSpec deep-clones and substitutes the model', () => {
    const { coder } = loadAgentDefinitions();
    const spec = buildSpec(coder, 'openai/gpt-x');
    expect(spec.model.name).toBe('openai/gpt-x');
    expect(coder.manifest.model.name).toBe('PLACEHOLDER/model');
    expect(spec.mcpServers).not.toBe(coder.manifest.mcpServers);
    expect(spec.model.params).toEqual({ temperature: 0.2 });
  });
});
