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
