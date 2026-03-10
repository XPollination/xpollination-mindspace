# Changelog: ms-a0-6-logging v0.0.1

## v0.0.1 — 2026-03-10

Initial design for structured logging framework.

### Changes

1. **New dep:** `pino` + `pino-http` — chosen over winston for performance (5x faster) and native JSON output
2. **New:** `api/lib/logger.ts` — singleton pino logger, level from `LOG_LEVEL` env var
3. **New:** `api/middleware/request-logger.ts` — pino-http with request ID (UUID or x-request-id passthrough), minimal serializers
4. **Modified:** `api/server.ts` — register request logger before routes
5. **Modified:** `api/middleware/error-handler.ts` — replace console.error with logger.error
