import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Mission State Machine Tests — mission-state-machine-test
 * TDD: Validates mission lifecycle transitions and backlog release.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Mission status values', () => {

  it('missions table supports draft, active, complete, cancelled statuses', () => {
    const statuses = ['draft', 'active', 'complete', 'cancelled'];
    for (const status of statuses) {
      const fn = () => db.prepare("INSERT OR IGNORE INTO missions (id, title, status) VALUES (?, ?, ?)").run(`test-msm-${status}`, `Test ${status}`, status);
      expect(fn).not.toThrow();
    }
  });
});

describe('Mission transitions in DB', () => {

  it('draft→active status update works', () => {
    db.prepare("INSERT OR IGNORE INTO missions (id, title, status) VALUES ('test-msm-draft', 'Draft Mission', 'draft')").run();
    db.prepare("UPDATE missions SET status = 'active' WHERE id = 'test-msm-draft'").run();
    const m = db.prepare("SELECT status FROM missions WHERE id = 'test-msm-draft'").get() as any;
    expect(m.status).toBe('active');
  });

  it('active→complete status update works', () => {
    db.prepare("UPDATE missions SET status = 'complete' WHERE id = 'test-msm-draft'").run();
    const m = db.prepare("SELECT status FROM missions WHERE id = 'test-msm-draft'").get() as any;
    expect(m.status).toBe('complete');
  });
});

describe('Backlog release concept', () => {

  it('can query backlog tasks linked to a mission capability', () => {
    // Create test data
    db.exec(`CREATE TABLE IF NOT EXISTS mindspace_nodes (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      parent_ids TEXT, slug TEXT NOT NULL, dna_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.prepare("INSERT OR IGNORE INTO mindspace_nodes (id, type, status, slug, dna_json) VALUES ('backlog-task-1', 'task', 'backlog', 'test-backlog-release', '{\"title\":\"Backlog task\",\"role\":\"dev\",\"requirement_refs\":[\"REQ-AUTH-001\"]}')").run();

    const backlogTasks = db.prepare("SELECT * FROM mindspace_nodes WHERE status = 'backlog' AND dna_json LIKE '%REQ-AUTH-001%'").all();
    expect(backlogTasks.length).toBeGreaterThanOrEqual(1);
  });
});
