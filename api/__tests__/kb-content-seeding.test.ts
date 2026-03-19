import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * KB Content Seeding Tests — kb-content-seeding
 * Validates: Migration 053 populates content_md for all hierarchy nodes.
 * TDD: Dev creates 053-seed-knowledge-content.sql.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Missions have content_md (WHY focus)', () => {

  const MISSIONS = ['mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab'];

  for (const mid of MISSIONS) {
    it(`${mid} has non-empty content_md`, () => {
      const row = db.prepare("SELECT content_md, content_version FROM missions WHERE id = ?").get(mid) as any;
      expect(row).toBeDefined();
      expect(row.content_md).toBeTruthy();
      expect(row.content_md.length).toBeGreaterThan(50);
    });
  }

  it('all 3 missions have content_version = 1', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM missions WHERE id IN ('mission-fair-attribution','mission-traversable-context','mission-agent-human-collab') AND content_version = 1").get() as any;
    expect(count.c).toBe(3);
  });
});

describe('Capabilities have content_md (WHAT focus)', () => {

  const CAPS = ['cap-auth', 'cap-task-engine', 'cap-agent-protocol', 'cap-foundation',
    'cap-quality', 'cap-graph', 'cap-viz', 'cap-provenance', 'cap-token'];

  for (const capId of CAPS) {
    it(`${capId} has non-empty content_md`, () => {
      const row = db.prepare("SELECT content_md, content_version FROM capabilities WHERE id = ?").get(capId) as any;
      expect(row).toBeDefined();
      expect(row.content_md).toBeTruthy();
      expect(row.content_md.length).toBeGreaterThan(30);
    });
  }

  it('all 9 capabilities have content_version = 1', () => {
    const ids = CAPS.map(c => `'${c}'`).join(',');
    const count = db.prepare(`SELECT COUNT(*) as c FROM capabilities WHERE id IN (${ids}) AND content_version = 1`).get() as any;
    expect(count.c).toBe(9);
  });
});

describe('Requirements have content_md (HOW focus)', () => {

  it('all 15 requirements have non-empty content_md', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND content_md IS NOT NULL AND content_md != ''").get() as any;
    expect(count.c).toBe(15);
  });

  it('all 15 requirements have content_version = 1', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE project_slug = 'mindspace' AND content_version = 1").get() as any;
    expect(count.c).toBe(15);
  });
});

describe('Migration file exists', () => {

  it('053-seed-knowledge-content.sql is present', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('053-seed-knowledge-content.sql');
  });
});
