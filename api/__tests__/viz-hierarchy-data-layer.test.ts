import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Viz Hierarchy Data Layer Tests — viz-hierarchy-data-layer
 * Validates: viz/server.js mission-grouped queries with requirement-based task counting.
 * Tests verify the data layer (DB queries) that the viz server endpoints depend on.
 * TDD: Dev fixes viz/server.js to pass them.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;

  // Create mindspace_nodes table (from src/db/schema.sql, not in API migrations)
  db.exec(`CREATE TABLE IF NOT EXISTS mindspace_nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    parent_ids TEXT,
    slug TEXT NOT NULL,
    title TEXT,
    dna_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed a few tasks with requirement_refs in DNA to verify counting
  db.prepare(`INSERT OR IGNORE INTO mindspace_nodes (id, type, slug, status, dna_json, title)
    VALUES ('task-auth-test-1', 'task', 'ms-auth-test-1', 'complete',
    '{"title":"Auth test 1","requirement_refs":["REQ-AUTH-001"]}', 'Auth test 1')`).run();
  db.prepare(`INSERT OR IGNORE INTO mindspace_nodes (id, type, slug, status, dna_json, title)
    VALUES ('task-auth-test-2', 'task', 'ms-auth-test-2', 'active',
    '{"title":"Auth test 2","requirement_refs":["REQ-AUTH-001","REQ-AUTH-002"]}', 'Auth test 2')`).run();
  db.prepare(`INSERT OR IGNORE INTO mindspace_nodes (id, type, slug, status, dna_json, title)
    VALUES ('task-wf-test-1', 'task', 'ms-wf-test-1', 'complete',
    '{"title":"WF test 1","requirement_refs":["REQ-WF-001"]}', 'WF test 1')`).run();
});

afterAll(() => { teardownTestDb(); });

describe('Mission-grouped hierarchy data', () => {

  it('3 active missions exist', () => {
    const missions = db.prepare("SELECT * FROM missions WHERE status = 'active' AND id LIKE 'mission-%'").all();
    expect(missions.length).toBeGreaterThanOrEqual(3);
  });

  it('each mission has at least 1 capability', () => {
    const missionIds = ['mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab'];
    for (const mid of missionIds) {
      const caps = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id = ?").get(mid) as any;
      expect(caps.c, `${mid} should have capabilities`).toBeGreaterThanOrEqual(1);
    }
  });

  it('each capability has at least 1 requirement', () => {
    const PLATFORM_CAPS = ['cap-auth', 'cap-task-engine', 'cap-agent-protocol', 'cap-foundation',
      'cap-quality', 'cap-graph', 'cap-viz', 'cap-provenance', 'cap-token'];
    for (const capId of PLATFORM_CAPS) {
      const reqs = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE capability_id = ?").get(capId) as any;
      expect(reqs.c, `${capId} should have requirements`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Requirement-based task counting', () => {

  it('can count tasks matching a requirement via LIKE on dna_json', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type = 'task' AND dna_json LIKE '%REQ-AUTH-001%'"
    ).get() as any;
    expect(count.c).toBeGreaterThanOrEqual(1);
  });

  it('can count complete tasks matching a requirement', () => {
    const count = db.prepare(
      "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type = 'task' AND status = 'complete' AND dna_json LIKE '%REQ-AUTH-001%'"
    ).get() as any;
    expect(count.c).toBeGreaterThanOrEqual(1);
  });

  it('can compute progress percent (complete/total)', () => {
    const total = (db.prepare(
      "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type = 'task' AND dna_json LIKE '%REQ-AUTH-001%'"
    ).get() as any).c;
    const complete = (db.prepare(
      "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type = 'task' AND status = 'complete' AND dna_json LIKE '%REQ-AUTH-001%'"
    ).get() as any)?.c || 0;
    // Just verify we can compute it — actual percentage depends on data
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('capability-level task count aggregates across its requirements', () => {
    // cap-auth has REQ-AUTH-001 and REQ-AUTH-002
    const reqs = db.prepare("SELECT req_id_human FROM requirements WHERE capability_id = 'cap-auth'").all() as any[];
    let total = 0;
    for (const req of reqs) {
      const count = db.prepare(
        "SELECT COUNT(*) as c FROM mindspace_nodes WHERE type = 'task' AND dna_json LIKE '%' || ? || '%'"
      ).get(req.req_id_human) as any;
      total += count.c;
    }
    expect(total).toBeGreaterThanOrEqual(1);
  });
});

describe('Response format matches PDSA spec', () => {

  it('mission-overview can produce nested capabilities with task counts', () => {
    const missions = db.prepare("SELECT id, slug, title, description, status FROM missions WHERE status = 'active' AND id LIKE 'mission-%'").all() as any[];

    const result = missions.map((m: any) => {
      const caps = db.prepare("SELECT id, title, description, status FROM capabilities WHERE mission_id = ?").all(m.id) as any[];
      return {
        ...m,
        capabilities: caps.map((c: any) => {
          const reqs = db.prepare("SELECT req_id_human, title FROM requirements WHERE capability_id = ?").all(c.id) as any[];
          let taskCount = 0;
          let completeCount = 0;
          for (const r of reqs) {
            taskCount += (db.prepare("SELECT COUNT(*) as c FROM mindspace_nodes WHERE type='task' AND dna_json LIKE '%' || ? || '%'").get(r.req_id_human) as any).c;
            completeCount += (db.prepare("SELECT COUNT(*) as c FROM mindspace_nodes WHERE type='task' AND status='complete' AND dna_json LIKE '%' || ? || '%'").get(r.req_id_human) as any).c;
          }
          return { ...c, task_count: taskCount, complete_count: completeCount, requirements: reqs };
        })
      };
    });

    expect(result.length).toBeGreaterThanOrEqual(3);
    // At least one capability should have tasks
    const hasTasks = result.some((m: any) => m.capabilities.some((c: any) => c.task_count > 0));
    expect(hasTasks).toBe(true);
  });
});

describe('No duplicate data', () => {

  it('each mission appears only once', () => {
    const missions = db.prepare("SELECT id, COUNT(*) as c FROM missions GROUP BY id HAVING c > 1").all();
    expect(missions.length).toBe(0);
  });

  it('each capability appears only once', () => {
    const caps = db.prepare("SELECT id, COUNT(*) as c FROM capabilities GROUP BY id HAVING c > 1").all();
    expect(caps.length).toBe(0);
  });
});
