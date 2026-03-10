// Test helper for auth integration tests
// Sets up in-memory SQLite with migrations and returns a configured Express app

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set env vars before any route modules capture them
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.JWT_EXPIRY = '24h';
process.env.DATABASE_PATH = ':memory:';

// Dynamic imports ensure env vars are set before module evaluation
let closeDb: () => void;
let getDb: () => Database.Database;

export async function createTestApp() {
  const connModule = await import('../db/connection.js');
  closeDb = connModule.closeDb;
  getDb = connModule.getDb;

  // Reset DB singleton — creates fresh :memory: DB
  closeDb();
  const db = getDb();

  // Run all migrations in order
  const migrationsDir = resolve(__dirname, '../db/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }

  // Import route modules (cached after first call, which is fine)
  const { authRouter } = await import('../routes/auth.js');
  const { keysRouter } = await import('../routes/keys.js');
  const { requireAuth } = await import('../middleware/auth.js');
  const { requireApiKeyOrJwt } = await import('../middleware/require-auth.js');

  const app = express();
  app.use(express.json());

  // Mount auth routes
  app.use('/api/auth', authRouter);
  app.use('/api/keys', keysRouter);

  // Test-only protected routes for verifying middleware
  app.get('/api/protected', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  app.get('/api/protected-combined', requireApiKeyOrJwt, (req, res) => {
    res.json({ user: (req as any).user });
  });

  return { app, db };
}

export function teardownTestDb(): void {
  if (closeDb) closeDb();
}
