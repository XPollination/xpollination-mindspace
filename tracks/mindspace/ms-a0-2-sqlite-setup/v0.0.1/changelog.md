# Changelog: ms-a0-2-sqlite-setup v0.0.1

## v0.0.1 — 2026-03-10

Initial design for SQLite database integration in the mindspace API server.

### Changes

1. **New:** `api/db/connection.ts` — singleton connection helper with WAL mode, foreign keys, and migrations table bootstrap
2. **Modified:** `api/server.ts` — database initialization on startup, graceful shutdown handlers (SIGTERM, SIGINT)
3. **Modified:** `api/routes/health.ts` — database connectivity check in health endpoint

### Design decisions

- Singleton pattern (not pool) — better-sqlite3 is synchronous, one connection per process is correct
- Migrations table created inline during connection init — no circular dependency on migration framework
- Separate from existing `src/db/client.ts` — API server has its own lifecycle
