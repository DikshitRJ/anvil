# `src/trueforge/client.ts`

**Purpose**
This file provides a factory function to create a TrueForge client. It also provides a function to check the health of the service.

**Exports**
* createClient(baseUrl: string): TrueForge - function. It creates a new TrueForge instance with a 600-second timeout and zero retries.
* checkHealth(baseUrl: string, timeoutMs: number): Promise<boolean> - function. It sends a request to the healthz endpoint and returns true if the response is successful.

**Collaborators**
* Imports: @truefoundry/trueforge-sdk
* Exports used by: Not visible from this file.

**Key behaviour and invariants**
* The `createClient` function sets `timeoutInSeconds` to 600.
* The `createClient` function sets `maxRetries` to 0.
* The `checkHealth` function returns false if the request fails or times out.
* The `checkHealth` function uses a default timeout of 2000 milliseconds.

**Notes**
* The `checkHealth` function catches all errors and returns a boolean.
