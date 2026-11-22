# `src/trueforge/transport.ts`

**Purpose**
Align the SDK HTTP transport with its bounded ten-minute request timeout during quiet local-model compaction.

**Exports**
- `TrueForgeTransport`: an Undici Agent that overrides request header and idle-body timeouts to 600,000 ms at dispatch time.

**Collaborators**
- `client.ts` shares one transport for SDK requests without replacing the global dispatcher.

**Invariants**
- Override at dispatch time: fetch supplies per-request defaults that would override constructor-only options.
- Preserve all other request options and the original handler, including cancellation propagation.
- Do not bypass TLS verification, redirect handling, network policy, or review gates.
