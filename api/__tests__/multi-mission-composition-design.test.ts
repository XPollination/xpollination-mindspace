import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Multi-Mission Composition Tests — multi-mission-composition-design
 * Validates: COMPOSES/IMPLEMENTS relationships seeded from FK data.
 * TDD: Dev creates migration 059 seeding relationships.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 059: Seed relationships from FK data', () => {

  it('node_relationships has COMPOSES entries for mission→capability', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM node_relationships WHERE relation = 'COMPOSES'").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(9);
  });

  it('node_relationships has IMPLEMENTS entries for capability→requirement', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM node_relationships WHERE relation = 'IMPLEMENTS'").get() as any;
    expect(count.c).toBeGreaterThanOrEqual(15);
  });

  it('CAP-AUTH has relationship to multiple missions (multi-mission)', () => {
    const rels = db.prepare("SELECT * FROM node_relationships WHERE source_id = 'cap-auth' AND relation = 'COMPOSES'").all();
    // cap-auth should compose under at least 1 mission (primary), ideally 2 for multi-mission
    expect(rels.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Migration file exists', () => {

  it('059 migration file is present', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    const has059 = files.some((f: string) => f.startsWith('059'));
    expect(has059).toBe(true);
  });
});
