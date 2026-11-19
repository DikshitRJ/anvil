// Agent definitions: loads agent/*.json and turns them into SDK-typed specs.
//
// Decision: agent/*.json keep TrueForge's native snake_case wire format (human-readable source of truth). The SDK
// takes camelCase request objects and its serializer (serialization.AgentSpec.jsonOrThrow) maps them back to
// snake_case on the wire, so toSdkSpec() camelCases every key EXCEPT those inside `model.params`, which is a free-form
// record that must reach the server verbatim (e.g. max_tokens). Verified by a round-trip test in spec.test.ts.
import type { TrueForgeApi } from '@truefoundry/trueforge-sdk';
import coderJson from '../../agent/anvil-coder.json';
import inlineJson from '../../agent/anvil-inline.json';

export interface AgentDefinition {
  name: string;
  description: string;
  manifest: TrueForgeApi.AgentSpec;
}

const camel = (k: string): string => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function camelize(v: unknown, parentKey = ''): unknown {
  if (Array.isArray(v)) return v.map((x) => camelize(x));
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    out[camel(k)] = parentKey === 'model' && k === 'params' ? val : camelize(val, k);
  }
  return out;
}

// converts a snake_case wire manifest to the SDK's camelCase AgentSpec (model.params stays verbatim)
export function toSdkSpec(wire: unknown): TrueForgeApi.AgentSpec {
  return camelize(wire) as TrueForgeApi.AgentSpec;
}

export function buildSpec(def: AgentDefinition, model: string): AgentDefinition['manifest'] {
  const spec = structuredClone(def.manifest);
  spec.model = { ...spec.model, name: model };
  return spec;
}

interface WireDefinition {
  name: string;
  description: string;
  manifest: unknown;
}

function toDefinition(wire: WireDefinition): AgentDefinition {
  return { name: wire.name, description: wire.description, manifest: toSdkSpec(wire.manifest) };
}

// imports the JSON files from agent/
export function loadAgentDefinitions(): { coder: AgentDefinition; inline: AgentDefinition } {
  return { coder: toDefinition(coderJson), inline: toDefinition(inlineJson) };
}
