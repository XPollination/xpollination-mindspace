import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Version History Table Design Tests — version-history-table-design
 * Validates: capability_version_history table schema.
 * TDD: Dev creates migration with table.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('capability_version_history table exists', () => {

  it('table exists in schema', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='capability_version_history'").get() as any;
    expect(table).toBeDefined();
  });

  it('has capability_id column', () => {
    const cols = db.prepare("PRAGMA table_info(capability_version_history)").all() as any[];
    expect(cols.some((c: any) => c.name === 'capability_id')).toBe(true);
  });

  it('has version column', () => {
    const cols = db.prepare("PRAGMA table_info(capability_version_history)").all() as any[];
    expect(cols.some((c: any) => c.name === 'version')).toBe(true);
  });

  it('has changelog or content column', () => {
    const cols = db.prepare("PRAGMA table_info(capability_version_history)").all() as any[];
    expect(cols.some((c: any) => c.name === 'changelog' || c.name === 'content_md' || c.name === 'changes')).toBe(true);
  });

  it('has changed_by column', () => {
    const cols = db.prepare("PRAGMA table_info(capability_version_history)").all() as any[];
    expect(cols.some((c: any) => c.name === 'changed_by')).toBe(true);
  });

  it('has index on capability_id', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='capability_version_history'").all() as any[];
    expect(indexes.length).toBeGreaterThanOrEqual(1);
  });
});
