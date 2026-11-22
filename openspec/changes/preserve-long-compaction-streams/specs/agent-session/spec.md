## ADDED Requirements

### Requirement: Aligned transport timeouts
The TrueForge SDK client SHALL use the same bounded ten-minute timeout for transport headers and idle response bodies as its configured request timeout, without modifying global transport defaults.

#### Scenario: Fetch supplies a shorter body timeout
- **WHEN** the HTTP transport receives fetch options with a shorter body timeout while a response remains valid
- **THEN** the client dispatcher overrides that timeout and continues reading the stream within the ten-minute bound

#### Scenario: Explicit cancellation
- **WHEN** the caller aborts a request while its response body is idle
- **THEN** the request terminates promptly despite the longer transport timeout
