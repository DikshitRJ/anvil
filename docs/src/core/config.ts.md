# `src/core/config.ts`

**Purpose**
Defines the Anvil settings shape, its defaults, and a merge function that validates user settings.

**Exports**
- `AnvilConfig` (interface): `trueforgeUrl`, `models` (string[]), `retriesPerModel`, `stallTimeoutSec`, `contextBudget`, `mcpPort`, `cancelBehavior` (`'revert' | 'keep'`), `commandTimeoutSec`.
- `DEFAULT_CONFIG`: `http://localhost:8790`, no models, 1 retry per model, 45 s stall timeout, 12000 context budget, MCP port 7801, cancel behaviour `revert`, 120 s command timeout.
- `mergeConfig(partial)`: overlays a `Partial<AnvilConfig>` on the defaults and returns a new object.

**Collaborators**
- Imports: none.
- Used by: the host config reader, run controller, fallback logic, MCP server.

**Key behaviour and invariants**
- Numeric fields are rounded and clamped by the private `clamp`: `retriesPerModel` 0-5, `stallTimeoutSec` 5-600, `contextBudget` 1000-200000, `mcpPort` 1024-65535, `commandTimeoutSec` 5-1800.
- `undefined` or non-finite numbers fall back to the default (they are not clamped).
- `trueforgeUrl` and `cancelBehavior` are taken as given with `??`; they are not validated here.
- `models` is copied, so callers never share the array with `DEFAULT_CONFIG`.
- `DEFAULT_CONFIG` is never mutated.

**Notes**
- Cancel behaviour `revert` rolls back the run's edits on cancel; `keep` leaves them (applied in the run controller).
