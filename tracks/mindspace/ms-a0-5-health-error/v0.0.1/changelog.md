# Changelog: ms-a0-5-health-error v0.0.1

## v0.0.1 — 2026-03-10

Initial design for global error handling middleware.

### Changes

1. **New:** `api/middleware/error-handler.ts` — global catch-all with structured JSON logging, safe responses (no stack traces leaked)
2. **New:** `api/middleware/not-found.ts` — 404 handler for unmatched routes
3. **Modified:** `api/server.ts` — register notFoundHandler and errorHandler after all routes
