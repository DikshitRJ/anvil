# `src/mcp/auth.ts`

**Purpose**
This file provides authentication checks for the local MCP bridge. It verifies bearer tokens and validates origin headers.

**Exports**
* checkBearer(header, token): boolean - function that compares a bearer token in a header against an expected token.
* isAllowedOrigin(origin): boolean - function that checks if a request origin is from a local loopback address.

**Collaborators**
* Imports: node:crypto
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* `checkBearer` returns false if the header is missing or does not match the Bearer format.
* `checkBearer` uses `timingSafeEqual` to prevent timing attacks.
* `checkBearer` returns false if the token lengths do not match.
* `isAllowedOrigin` returns true if the origin is undefined or an empty string.
* `isAllowedOrigin` allows any origin if the client is not a browser.

**Notes**
* The `LOOPBACK_ORIGIN` regex allows `127.0.0.1`, `localhost`, and `[::1]`.
