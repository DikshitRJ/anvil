# `src/mcp/auth.ts`

**Purpose**
Bearer-token and Origin checks for the local MCP bridge.

**Exports**
- `checkBearer(header, token)`: boolean.
- `isAllowedOrigin(origin)`: boolean.

**Collaborators**
- Imports: `node:crypto` (`timingSafeEqual`).
- Used by: `mcp/server.ts`.

**Key behaviour and invariants**
- `checkBearer` is false if the header or the expected token is missing/empty, or the header is not exactly `Bearer <value>`. Lengths are compared first (different length is false), then `timingSafeEqual` compares the bytes in constant time.
- `isAllowedOrigin`: no `Origin` (undefined or empty, i.e. non-browser clients such as TrueForge) is allowed; otherwise the origin must match `http(s)://127.0.0.1|localhost|[::1]` with an optional port. This blocks other websites from calling the bridge through the browser.

**Notes**
- The token is a per-install secret kept in VS Code secrets (see `extension.ts`).
