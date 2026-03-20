import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Relationship Table Design Tests — relationship-table-design
 * Validates: node_relationships table with SpiceDB-compatible tuples.
 * TDD: Dev creates migration with table.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('node_relationships table', () => {

  it('table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='node_relationships'").get() as any;
    expect(table).toBeDefined();
  });

  it('has source_type and source_id columns', () => {
    const cols = db.prepare("PRAGMA table_info(node_relationships)").all() as any[];
    expect(cols.some((c: any) => c.name === 'source_type')).toBe(true);
    expect(cols.some((c: any) => c.name === 'source_id')).toBe(true);
  });

  it('has relation column', () => {
    const cols = db.prepare("PRAGMA table_info(node_relationships)").all() as any[];
    expect(cols.some((c: any) => c.name === 'relation')).toBe(true);
  });

  it('has target_type and target_id columns', () => {
    const cols = db.prepare("PRAGMA table_info(node_relationships)").all() as any[];
    expect(cols.some((c: any) => c.name === 'target_type')).toBe(true);
    expect(cols.some((c: any) => c.name === 'target_id')).toBe(true);
  });

  it('has metadata column', () => {
    const cols = db.prepare("PRAGMA table_info(node_relationships)").all() as any[];
    expect(cols.some((c: any) => c.name === 'metadata')).toBe(true);
  });

  it('has indexes for efficient lookups', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='node_relationships'").all() as any[];
    expect(indexes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('CLI relationship commands', () => {

  it('interface-cli.js has relationship-create or relationship command', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const cliPath = resolve(__dirname, '../../src/db/interface-cli.js');
    const content = existsSync(cliPath) ? readFileSync(cliPath, 'utf-8') : '';
    expect(content).toMatch(/relationship|relation/i);
  });
});
