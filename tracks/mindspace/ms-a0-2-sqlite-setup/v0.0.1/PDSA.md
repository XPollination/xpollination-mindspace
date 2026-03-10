# PDSA: SQLite database setup + connection pool

**Task:** ms-a0-2-sqlite-setup
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-API-001

## Problem

The Express API server (`api/server.ts`) has no database integration. It serves a health endpoint but cannot access SQLite. The mindspace API needs:
1. A database connection helper for the API layer
2. A `migrations` table to track schema changes
3. Database connectivity in the health check
4. Graceful shutdown on process exit

### Existing Code

- `src/db/client.ts` — MCP content pipeline DB init (loads full schema.sql, creates repositories). This is **not reusable** for the API server because it's tightly coupled to the content pipeline schema and repositories.
- `better-sqlite3@^11.0.0` already in package.json
- `api/server.ts` — minimal Express app, no DB
- `api/routes/health.ts` — returns `{status: 'ok'}`, no DB check

### Acceptance Criteria (from DNA)

1. Server starts with DB connected
2. `migrations` table exists after initialization

## Design

### Change A: Database connection module — `api/db/connection.ts`

New module that provides a singleton database connection for the API server:

```typescript
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

/**
 * Get or create the database connection.
 * Uses DATABASE_PATH env var, defaults to ./data/mindspace.db
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DATABASE_PATH || './data/mindspace.db';
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create migrations table on first connection
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now')),
      checksum TEXT
    )
  `);

  return db;
}

/**
 * Close the database connection. Call on graceful shutdown.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**Design decisions:**
- **Singleton pattern** — better-sqlite3 is synchronous and single-connection. No pool needed (unlike async drivers). One connection per process is correct.
- **`migrations` table created inline** — keeps the bootstrap dependency-free. No migration framework needed to create the migration tracker itself.
- **`checksum` column** — optional field for future integrity checks (A0.7 can use it).
- **Separate from `src/db/client.ts`** — the API server has its own lifecycle. The existing client.ts serves the MCP content pipeline and will be deprecated as the API matures.
- **`foreign_keys = ON`** — SQLite disables foreign keys by default. Must enable per connection.

### Change B: Wire database into Express startup — `api/server.ts`

```typescript
import express from 'express';
import { healthRouter } from './routes/health.js';
import { getDb, closeDb } from './db/connection.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());

// Initialize database before starting
const db = getDb();
console.log(`Database connected (WAL mode, migrations table ready)`);

app.use('/health', healthRouter);

const server = app.listen(PORT, () => {
  console.log(`Mindspace API server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

export { app };
```

### Change C: Add DB status to health check — `api/routes/health.ts`

```typescript
import { Router } from 'express';
import { getDb } from '../db/connection.js';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  let dbStatus = 'ok';
  try {
    const db = getDb();
    // Quick integrity check — ensures DB is readable
    db.prepare('SELECT 1').get();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    version: '0.0.7',
    uptime: process.uptime(),
    database: dbStatus
  });
});

export { healthRouter };
```

### Files Changed

1. `api/db/connection.ts` — **new** — database connection singleton + migrations table bootstrap
2. `api/server.ts` — **modified** — import getDb/closeDb, init on startup, graceful shutdown
3. `api/routes/health.ts` — **modified** — add database connectivity check

### What This Does NOT Include (deferred to other tasks)

- **A0.7 (migration framework):** Runner, CLI, file-based migrations — depends on this task
- **Repository layer:** Task/project/user repositories — separate capability tasks
- **Connection error retry:** better-sqlite3 is synchronous; if DB path is wrong, it throws immediately. No retry loop needed for a local file DB.

### Testing

1. Server starts without error when DATABASE_PATH points to a writable location
2. `migrations` table exists after server starts (`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`)
3. `GET /health` returns `{"status":"ok","database":"ok"}` when DB is connected
4. `GET /health` returns `{"status":"degraded","database":"error"}` when DB is broken (e.g., file deleted after startup)
5. SIGTERM causes clean shutdown (DB connection closed)
6. WAL mode is enabled (`PRAGMA journal_mode` returns `wal`)
7. Foreign keys are enabled (`PRAGMA foreign_keys` returns `1`)
8. `getDb()` returns same instance on repeated calls (singleton)
9. `closeDb()` + `getDb()` creates new instance (re-initialization)
10. `migrations` table has correct columns: id, name, executed_at, checksum
