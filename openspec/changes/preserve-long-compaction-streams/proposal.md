# Preserve long compaction streams

## Why
A live local Qwen run remained healthy during context compaction, but Node fetch terminated its silent SSE body after the transport default of five minutes. The SDK's ten-minute request setting did not override that lower-level body timeout, triggering a retry and rollback.

## What Changes
Use a client-scoped Undici dispatcher that enforces the same ten-minute header and body limits as the SDK, overriding fetch's internal defaults. Leave global fetch and other extensions untouched. Keep cancellation signals and the session stall watchdog authoritative.

## Impact
TrueForge transport, integration regression tests, mirrored documentation, and one runtime dependency compatible with Node 20.
