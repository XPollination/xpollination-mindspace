import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Relationship Table Tests — relationship-table-test
 * TDD: Validates node_relationships CRUD and constraints.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Insert and query relationships', () => {

  it('can insert a COMPOSES relationship', () => {
    const fn = () => db.prepare(
      "INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES ('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-auth', 'system')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('can query relationships by source', () => {
    const rels = db.prepare("SELECT * FROM node_relationships WHERE source_type = 'mission' AND source_id = 'mission-fair-attribution'").all();
    expect(rels.length).toBeGreaterThanOrEqual(1);
  });

  it('can query relationships by target', () => {
    const rels = db.prepare("SELECT * FROM node_relationships WHERE target_type = 'capability' AND target_id = 'cap-auth'").all();
    expect(rels.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Unique constraint prevents duplicates', () => {

  it('duplicate tuple rejected', () => {
    const fn = () => db.prepare(
      "INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by) VALUES ('mission', 'mission-fair-attribution', 'COMPOSES', 'capability', 'cap-auth', 'system')"
    ).run();
    expect(fn).toThrow();
  });
});

describe('Metadata support', () => {

  it('can store JSON metadata', () => {
    db.prepare(
      "INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, metadata, created_by) VALUES ('capability', 'cap-auth', 'IMPLEMENTS', 'requirement', 'req-auth-001', '{\"confidence\":0.95}', 'dev')"
    ).run();
    const rel = db.prepare("SELECT metadata FROM node_relationships WHERE source_id = 'cap-auth' AND relation = 'IMPLEMENTS'").get() as any;
    expect(JSON.parse(rel.metadata).confidence).toBe(0.95);
  });
});
