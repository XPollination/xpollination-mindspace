import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Version History Table Tests — version-history-table-test
 * TDD: Validates capability_version_history table CRUD operations.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Can insert version entries', () => {

  it('insert a version entry for cap-auth', () => {
    const fn = () => db.prepare(
      "INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 1, 'Initial auth implementation', 'system')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('retrieve version entry', () => {
    const entry = db.prepare("SELECT * FROM capability_version_history WHERE capability_id = 'cap-auth' AND version = 1").get() as any;
    expect(entry).toBeDefined();
    expect(entry.changelog).toBe('Initial auth implementation');
    expect(entry.changed_by).toBe('system');
  });
});

describe('Version uniqueness enforced', () => {

  it('duplicate (capability_id, version) rejected', () => {
    const fn = () => db.prepare(
      "INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 1, 'Duplicate', 'system')"
    ).run();
    expect(fn).toThrow();
  });
});

describe('Multiple versions per capability', () => {

  it('can have version 1 and version 2 for same capability', () => {
    db.prepare("INSERT INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 2, 'Added OAuth', 'dev')").run();
    const count = db.prepare("SELECT COUNT(*) as c FROM capability_version_history WHERE capability_id = 'cap-auth'").get() as any;
    expect(count.c).toBe(2);
  });
});
