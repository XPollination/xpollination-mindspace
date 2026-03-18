import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Populate Missions Tests — graph-populate-missions
 * Validates: Migration 047 seeds 3 PLATFORM-001 missions.
 * TDD: These tests define the spec. Dev creates 047-populate-missions.sql to pass them.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 047: Populate 3 missions from PLATFORM-001', () => {

  it('Fair Attribution mission exists', () => {
    const m = db.prepare("SELECT * FROM missions WHERE id = 'mission-fair-attribution'").get() as any;
    expect(m).toBeDefined();
    expect(m.title).toMatch(/Fair Attribution/i);
    expect(m.status).toBe('active');
    expect(m.slug).toBe('MISSION-FAIR-ATTR');
    expect(m.description).toBeTruthy();
  });

  it('Traversable Context mission exists', () => {
    const m = db.prepare("SELECT * FROM missions WHERE id = 'mission-traversable-context'").get() as any;
    expect(m).toBeDefined();
    expect(m.title).toMatch(/Traversable Context/i);
    expect(m.status).toBe('active');
    expect(m.slug).toBe('MISSION-TRAV-CTX');
    expect(m.description).toBeTruthy();
  });

  it('Agent-Human Collaboration mission exists', () => {
    const m = db.prepare("SELECT * FROM missions WHERE id = 'mission-agent-human-collab'").get() as any;
    expect(m).toBeDefined();
    expect(m.title).toMatch(/Agent.Human Collaboration/i);
    expect(m.status).toBe('active');
    expect(m.slug).toBe('MISSION-AH-COLLAB');
    expect(m.description).toBeTruthy();
  });

  it('exactly 3 new PLATFORM-001 missions exist', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM missions WHERE id IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab')").get() as any;
    expect(count.c).toBe(3);
  });

  it('all 3 missions have status=active', () => {
    const active = db.prepare("SELECT COUNT(*) as c FROM missions WHERE id IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab') AND status = 'active'").get() as any;
    expect(active.c).toBe(3);
  });

  it('existing mission-mindspace is preserved', () => {
    const m = db.prepare("SELECT * FROM missions WHERE id = 'mission-mindspace'").get() as any;
    expect(m).toBeDefined();
  });
});

describe('Idempotency', () => {

  it('re-inserting missions with INSERT OR IGNORE does not error', () => {
    const fn = () => {
      db.prepare("INSERT OR IGNORE INTO missions (id, title, slug, description, status) VALUES ('mission-fair-attribution', 'Fair Attribution', 'MISSION-FAIR-ATTR', 'test', 'active')").run();
      db.prepare("INSERT OR IGNORE INTO missions (id, title, slug, description, status) VALUES ('mission-traversable-context', 'Traversable Context', 'MISSION-TRAV-CTX', 'test', 'active')").run();
      db.prepare("INSERT OR IGNORE INTO missions (id, title, slug, description, status) VALUES ('mission-agent-human-collab', 'Agent-Human Collaboration', 'MISSION-AH-COLLAB', 'test', 'active')").run();
    };
    expect(fn).not.toThrow();
  });

  it('mission count stays at 3 after duplicate inserts', () => {
    db.prepare("INSERT OR IGNORE INTO missions (id, title, slug, description, status) VALUES ('mission-fair-attribution', 'Fair Attribution', 'MISSION-FAIR-ATTR', 'test', 'active')").run();
    const count = db.prepare("SELECT COUNT(*) as c FROM missions WHERE id IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab')").get() as any;
    expect(count.c).toBe(3);
  });
});

describe('Migration file exists', () => {

  it('047-populate-missions.sql is present in migrations directory', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('047-populate-missions.sql');
  });
});
