# `src/trueforge/spec.ts`

**Purpose**
This file loads agent definitions from JSON files and converts them into SDK-typed specifications. It ensures that the SDK uses camelCase keys while keeping model parameters in their original snake_case format.

**Exports**
* AgentDefinition(params): AgentDefinition - interface - Defines the structure for an agent name, description, and manifest.
* toSdkSpec(wire: unknown): TrueForgeApi.AgentSpec - function - Converts a snake_case wire manifest into a camelCase SDK specification.
* buildSpec(def: AgentDefinition, model: string): AgentDefinition['manifest'] - function - Creates a new manifest object with a specific model name.
* loadAgentDefinitions(): { coder: AgentDefinition; inline: AgentDefinition } - function - Loads and converts the coder and inline agent JSON files.

**Collaborators**
* Imports: @truefoundry/trueforge-sdk, ../../agent/anvil-coder.json, ../../agent/anvil-inline.json.
* Exports: Not visible from this file.

**Key behaviour and invariants**
* The `camelize` function converts snake_case keys to camelCase.
* The function preserves snake_case for keys inside `model.params`.
* `buildSpec` uses `structuredClone` to create a deep copy of the manifest.
* `toSdkSpec` casts the result to `TrueForgeApi.AgentSpec`.

**Notes**
* The `model.params` object is a free-form record and must reach the server verbatim.
