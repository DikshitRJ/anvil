# `src/trueforge/spec.ts`

**Purpose**
Loads the agent definitions from `agent/*.json` and converts them into SDK-typed specs.

**Exports**
- `AgentDefinition`: `name`, `description`, `manifest` (`TrueForgeApi.AgentSpec`).
- `toSdkSpec(wire)`: camelCases a snake_case wire manifest.
- `buildSpec(def, model)`: deep copy of the manifest with `model.name` replaced.
- `loadAgentDefinitions()`: `{ coder, inline }` from `agent/anvil-coder.json` and `agent/anvil-inline.json`.

**Collaborators**
- Imports: TrueForge SDK types, `../../agent/anvil-coder.json`, `../../agent/anvil-inline.json`.
- Used by: `extension.ts`, `trueforge/setup.ts`, `trueforge/session.ts`, `host/runController.ts`.

**Key behaviour and invariants**
- The JSON files keep TrueForge's native snake_case wire format; the SDK expects camelCase request objects and converts back on the wire.
- `camelize` converts every key except the contents of `model.params` (a free-form record such as `max_tokens` that must reach the server verbatim).
- `buildSpec` uses `structuredClone`, so the loaded definition is never mutated and sessions can use different models.

**Notes**
- A round-trip test (`spec.test.ts`) guards the wire format.
