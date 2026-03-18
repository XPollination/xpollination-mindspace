import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Populate Capabilities Tests — graph-populate-capabilities
 * Validates: Migration 048 populates 9 PLATFORM-001 capabilities linked to missions.
 * TDD: These tests define the spec. Dev creates 048-populate-capabilities.sql to pass them.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 048: 9 PLATFORM-001 capabilities', () => {

  const PLATFORM_CAPS = [
    { id: 'cap-auth', mission: 'mission-agent-human-collab', title: /AUTH/i },
    { id: 'cap-task-engine', mission: 'mission-traversable-context', title: /TASK.ENGINE/i },
    { id: 'cap-agent-protocol', mission: 'mission-agent-human-collab', title: /AGENT.PROTOCOL/i },
    { id: 'cap-foundation', mission: 'mission-agent-human-collab', title: /FOUNDATION/i },
    { id: 'cap-quality', mission: 'mission-agent-human-collab', title: /QUALITY/i },
    { id: 'cap-graph', mission: 'mission-traversable-context', title: /GRAPH/i },
    { id: 'cap-viz', mission: 'mission-traversable-context', title: /VIZ/i },
    { id: 'cap-provenance', mission: 'mission-fair-attribution', title: /PROVENANCE/i },
    { id: 'cap-token', mission: 'mission-fair-attribution', title: /TOKEN/i },
  ];

  for (const cap of PLATFORM_CAPS) {
    it(`${cap.id} exists with correct mission_id`, () => {
      const row = db.prepare("SELECT * FROM capabilities WHERE id = ?").get(cap.id) as any;
      expect(row).toBeDefined();
      expect(row.mission_id).toBe(cap.mission);
      expect(row.title).toMatch(cap.title);
      expect(row.description).toBeTruthy();
    });
  }

  it('all 9 PLATFORM-001 capabilities have descriptions', () => {
    const ids = PLATFORM_CAPS.map(c => `'${c.id}'`).join(',');
    const count = db.prepare(`SELECT COUNT(*) as c FROM capabilities WHERE id IN (${ids}) AND description IS NOT NULL AND description != ''`).get() as any;
    expect(count.c).toBe(9);
  });
});

describe('Mission distribution', () => {

  it('mission-agent-human-collab has at least 4 capabilities', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id = 'mission-agent-human-collab'").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(4);
  });

  it('mission-traversable-context has at least 3 capabilities', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id = 'mission-traversable-context'").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(3);
  });

  it('mission-fair-attribution has at least 2 capabilities', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id = 'mission-fair-attribution'").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(2);
  });
});

describe('Legacy capabilities preserved', () => {

  it('legacy capabilities still under mission-mindspace', () => {
    const legacy = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id = 'mission-mindspace'").get() as any;
    expect(legacy.c).toBeGreaterThanOrEqual(1);
  });
});

describe('Idempotency', () => {

  it('re-inserting new capabilities with INSERT OR IGNORE does not error', () => {
    const fn = () => {
      db.prepare("INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order) VALUES ('cap-graph', 'mission-traversable-context', 'CAP-GRAPH', 'test', 'active', 11)").run();
      db.prepare("INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order) VALUES ('cap-viz', 'mission-traversable-context', 'CAP-VIZ', 'test', 'active', 12)").run();
      db.prepare("INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order) VALUES ('cap-provenance', 'mission-fair-attribution', 'CAP-PROVENANCE', 'test', 'active', 13)").run();
      db.prepare("INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order) VALUES ('cap-token', 'mission-fair-attribution', 'CAP-TOKEN', 'test', 'active', 14)").run();
    };
    expect(fn).not.toThrow();
  });
});

describe('Total capability count', () => {

  it('at least 14 capabilities total (9 PLATFORM-001 + 5 legacy)', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM capabilities").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(14);
  });
});

describe('Migration file exists', () => {

  it('048-populate-capabilities.sql is present in migrations directory', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('048-populate-capabilities.sql');
  });
});
