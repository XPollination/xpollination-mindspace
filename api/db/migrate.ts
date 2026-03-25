import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { getDb } from './connection.js';
import { logger } from '../lib/logger.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations');

export async function runMigrations(): Promise<void> {
  const db = getDb();

  // Ensure migrations tracking table exists
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Read .sql files and sort by numeric prefix
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      return numA - numB;
    });

  const applied = db.prepare('SELECT name, checksum FROM migrations').all() as Array<{ name: string; checksum: string }>;
  const appliedMap = new Map(applied.map(r => [r.name, r.checksum]));

  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    const checksum = createHash('sha256').update(sql).digest('hex');

    if (appliedMap.has(file)) {
      // Check for checksum mismatch on already-applied migration
      if (appliedMap.get(file) !== checksum) {
        throw new Error(`Checksum mismatch for migration ${file}: file has been modified after being applied`);
      }
      continue;
    }

    // Disable FK checks for migrations that recreate tables (e.g., ALTER CHECK constraint)
    // PRAGMA must be outside transaction to take effect.
    const needsFkOff = sql.includes('DROP TABLE') || sql.includes('PRAGMA foreign_keys');
    if (needsFkOff) db.pragma('foreign_keys = OFF');

    // Apply migration in a transaction
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name, checksum) VALUES (?, ?)').run(file, checksum);
    });
    run();

    if (needsFkOff) db.pragma('foreign_keys = ON');

    logger.info({ migration: file }, `Applied migration: ${file}`);
  }
}

// Run directly when executed as script
const isDirectRun = process.argv[1]?.endsWith('migrate.js') || process.argv[1]?.endsWith('migrate.ts');
if (isDirectRun) {
  runMigrations()
    .then(() => {
      logger.info('All migrations applied');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
