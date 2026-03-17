import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Unified Database Tests — ms-unified-database
 * Validates: single DB source of truth, tasks table has DNA fields, CLI reads from unified DB.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'unified-db-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'unified@test.com', '$2b$10$placeholder', 'Unified User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'unified@test.com' }, process.env.JWT_SECRET!);
});

afterAll(() => { teardownTestDb(); });

describe('Single database source of truth', () => {

  it('tasks table exists in API database', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get();
    expect(table).not.toBeUndefined();
  });

  it('tasks table has dna column (JSON)', () => {
    const info = db.prepare("PRAGMA table_info(tasks)").all() as any[];
    const dnaCol = info.find((c: any) => c.name === 'dna');
    expect(dnaCol).not.toBeUndefined();
  });

  it('tasks table has slug column', () => {
    const info = db.prepare("PRAGMA table_info(tasks)").all() as any[];
    const slugCol = info.find((c: any) => c.name === 'slug');
    expect(slugCol).not.toBeUndefined();
  });

  it('tasks table has status column', () => {
    const info = db.prepare("PRAGMA table_info(tasks)").all() as any[];
    const statusCol = info.find((c: any) => c.name === 'status');
    expect(statusCol).not.toBeUndefined();
  });

  it('no separate mindscape_nodes table needed', () => {
    // After unification, mindscape_nodes should be migrated into tasks
    // The API DB should NOT have mindscape_nodes
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindscape_nodes'").get();
    expect(table).toBeUndefined();
  });
});
