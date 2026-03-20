import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Version Timeline Browser Tests — version-timeline-browser-test
 * TDD: Validates version timeline rendering and data queries.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Version timeline data available', () => {

  it('can insert and query version history entries', () => {
    db.prepare("INSERT OR IGNORE INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 1, 'Initial implementation', 'dev')").run();
    db.prepare("INSERT OR IGNORE INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 2, 'Added OAuth support', 'dev')").run();

    const entries = db.prepare("SELECT * FROM capability_version_history WHERE capability_id = 'cap-auth' ORDER BY version DESC").all() as any[];
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].version).toBeGreaterThan(entries[1].version);
  });

  it('version entries have changelog and changed_by', () => {
    const entry = db.prepare("SELECT * FROM capability_version_history WHERE capability_id = 'cap-auth' AND version = 1").get() as any;
    expect(entry.changelog).toBeTruthy();
    expect(entry.changed_by).toBeTruthy();
  });
});

describe('Expandable timeline concept', () => {

  it('can limit to 3 most recent versions', () => {
    db.prepare("INSERT OR IGNORE INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 3, 'Version 3', 'dev')").run();
    db.prepare("INSERT OR IGNORE INTO capability_version_history (capability_id, version, changelog, changed_by) VALUES ('cap-auth', 4, 'Version 4', 'dev')").run();

    const recent = db.prepare("SELECT * FROM capability_version_history WHERE capability_id = 'cap-auth' ORDER BY version DESC LIMIT 3").all();
    expect(recent.length).toBe(3);
  });
});
