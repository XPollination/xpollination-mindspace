# PDSA: Database migration framework

**Task:** ms-a0-7-migrations
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The mindspace API needs a database migration framework to manage schema changes over time. Currently, `connection.ts` creates the `migrations` tracking table on first connection (from ms-a0-2-sqlite-setup), but there is no runner to apply migration files.

Downstream tasks (A1.1 user table, A3.1 tasks table, etc.) need migrations to create their tables.

## Requirements (REQ-API-001 §A0.7)

> Migration runner: reads SQL files from migrations/ folder, applies in order, tracks applied migrations in DB. AC: `npm run migrate` applies pending migrations.

## Investigation

### Existing infrastructure

- **`api/db/connection.ts`**: Creates `migrations` table with columns `id`, `name` (UNIQUE), `executed_at`, `checksum`. Uses better-sqlite3 (synchronous).
- **`package.json`**: Has `"db:migrate": "tsx src/db/migrate.ts"` — points to MCP server path, not api/. File doesn't exist.
- **`api/server.ts`**: Calls `getDb()` on startup. Does NOT run migrations automatically.

### Design decisions

1. **SQL files, not TypeScript** — requirement says "reads SQL files from migrations/ folder". Keep it simple.
2. **Filename ordering** — `001_create_users.sql`, `002_create_tasks.sql`. Numeric prefix determines order.
3. **Checksum tracking** — SHA-256 of file content. Detects if an applied migration was modified (error, don't auto-fix).
4. **Separate runner script** — `api/db/migrate.ts`. Called via npm script. NOT auto-run on server start (explicit migration step).
5. **Transaction per migration** — each migration runs in a transaction. If it fails, that migration rolls back, subsequent ones don't run.

## Design

### File: `api/db/migrate.ts`

Migration runner entry point. Called via `npm run api:migrate`.

```typescript
import { getDb, closeDb } from './connection.js';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { logger } from '../lib/logger.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations');

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function run(): void {
  const db = getDb();

  // Read migration files sorted by name
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Get already-applied migrations
  const applied = new Map<string, string>(
    db.prepare('SELECT name, checksum FROM migrations').all()
      .map((row: any) => [row.name, row.checksum])
  );

  let count = 0;

  for (const file of files) {
    const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const hash = checksum(content);

    if (applied.has(file)) {
      // Verify checksum hasn't changed
      if (applied.get(file) !== hash) {
        logger.error({ file, expected: applied.get(file), actual: hash },
          'Migration checksum mismatch — file was modified after being applied');
        process.exit(1);
      }
      continue; // Already applied
    }

    // Apply migration in a transaction
    logger.info({ file }, 'Applying migration');
    const transaction = db.transaction(() => {
      db.exec(content);
      db.prepare('INSERT INTO migrations (name, checksum) VALUES (?, ?)')
        .run(file, hash);
    });

    try {
      transaction();
      count++;
    } catch (err) {
      logger.error({ file, err }, 'Migration failed');
      closeDb();
      process.exit(1);
    }
  }

  logger.info({ applied: count, total: files.length }, 'Migrations complete');
  closeDb();
}

run();
```

### Directory: `api/db/migrations/`

Empty directory with a `.gitkeep`. Future tasks add SQL files here:

```
api/db/migrations/
├── .gitkeep
└── (future: 001_create_users.sql, 002_create_tasks.sql, etc.)
```

### File: `package.json` (update)

Add `api:migrate` script:

```json
"api:migrate": "tsx api/db/migrate.ts"
```

The existing `db:migrate` (MCP server side) is left unchanged.

### Server startup integration

`api/server.ts` does NOT auto-run migrations. Migrations are explicit:

```bash
npm run api:migrate  # Apply pending migrations
npm run api:dev      # Start API server
```

This prevents accidental schema changes on restart. Production deployments run `api:migrate` as a separate step before starting the server.

## Files Changed

1. `api/db/migrate.ts` — new migration runner
2. `api/db/migrations/.gitkeep` — new empty migrations directory
3. `package.json` — add `api:migrate` script

## Testing

1. `migrate.ts` exists and exports a runner
2. Runner reads files from `api/db/migrations/` directory
3. Runner filters for `.sql` files only
4. Runner sorts files by name (alphabetical = numeric order)
5. Runner tracks applied migrations with checksum
6. Runner detects checksum mismatch (modified applied migration → error)
7. Runner skips already-applied migrations
8. Runner applies each migration in a transaction
9. Runner logs applied count and total count
10. `package.json` has `api:migrate` script pointing to `tsx api/db/migrate.ts`
11. `api/db/migrations/` directory exists with `.gitkeep`
