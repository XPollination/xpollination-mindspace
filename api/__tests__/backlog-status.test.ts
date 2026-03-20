import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Backlog Status Tests — backlog-status-test
 * TDD: Validates backlog status, transitions, and exclusions.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Create mindspace_nodes table if not exists (from src/db/schema.sql, not API migrations)
  db.exec(`CREATE TABLE IF NOT EXISTS mindspace_nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    parent_ids TEXT,
    slug TEXT NOT NULL,
    dna_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

afterAll(() => { teardownTestDb(); });

describe('Backlog is a valid status', () => {

  it('can insert task with backlog status', () => {
    const fn = () => db.prepare(
      "INSERT OR IGNORE INTO mindspace_nodes (id, type, status, slug, dna_json) VALUES ('test-backlog-1', 'task', 'backlog', 'test-backlog-slug', '{\"title\":\"Backlog test\",\"role\":\"dev\"}')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('backlog task exists after insert', () => {
    const node = db.prepare("SELECT status FROM mindspace_nodes WHERE id = 'test-backlog-1'").get() as any;
    expect(node).toBeDefined();
    expect(node.status).toBe('backlog');
  });
});

describe('Backlog transitions work in DB', () => {

  it('backlog→pending transition (status update)', () => {
    db.prepare("UPDATE mindspace_nodes SET status = 'pending' WHERE id = 'test-backlog-1'").run();
    const node = db.prepare("SELECT status FROM mindspace_nodes WHERE id = 'test-backlog-1'").get() as any;
    expect(node.status).toBe('pending');
  });

  it('pending→backlog transition (re-prioritize)', () => {
    db.prepare("UPDATE mindspace_nodes SET status = 'backlog' WHERE id = 'test-backlog-1'").run();
    const node = db.prepare("SELECT status FROM mindspace_nodes WHERE id = 'test-backlog-1'").get() as any;
    expect(node.status).toBe('backlog');
  });
});

describe('Backlog excluded from active work queries', () => {

  it('backlog tasks not returned by non-terminal filter', () => {
    const nodes = db.prepare("SELECT * FROM mindspace_nodes WHERE status NOT IN ('complete', 'cancelled', 'backlog') AND id = 'test-backlog-1'").all();
    expect(nodes.length).toBe(0);
  });
});
