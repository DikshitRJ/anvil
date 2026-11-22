# `src/trueforge/client.ts`

**Purpose**
Factory for the TrueForge SDK client and a cheap health probe.

**Exports**
- `createClient(baseUrl)`: returns a `TrueForge` client with `timeoutInSeconds: 600` and `maxRetries: 0`, using a dedicated shared SDK transport with matching header/body limits.
- `checkHealth(baseUrl, timeoutMs = 2000)`: `GET {baseUrl}/healthz`, true only for an OK response.

**Collaborators**
- Imports: `@truefoundry/trueforge-sdk`.
- Used by: `extension.ts` (client, health loop), `host/doctor.ts`.

**Key behaviour and invariants**
- SDK retries are disabled on purpose: retrying and model fallback are handled by `ModelRelay` and `AnvilSession`, so a hidden SDK retry would double them.
- `checkHealth` never throws; network errors and timeouts return `false`.

**Notes**
- Creating a client does no I/O. The SDK transport is shared within this module; global fetch defaults and the separate health probe remain unchanged.
