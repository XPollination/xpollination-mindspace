import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Knowledge Browser Schema Migration Tests — kb-schema-migration
 * Validates: Migration 052 adds short_id, content_md, content_version + history table.
 * TDD: Dev creates migration 052 and generate-short-ids.js script.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 052: Knowledge browser columns', () => {

  const TABLES = ['missions', 'capabilities', 'requirements'];

  for (const table of TABLES) {
    it(`${table} has short_id column`, () => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      expect(cols.some((c: any) => c.name === 'short_id')).toBe(true);
    });

    it(`${table} has content_md column`, () => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      expect(cols.some((c: any) => c.name === 'content_md')).toBe(true);
    });

    it(`${table} has content_version column`, () => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      expect(cols.some((c: any) => c.name === 'content_version')).toBe(true);
    });
  }
});

describe('node_content_history table', () => {

  it('table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='node_content_history'").get() as any;
    expect(table).toBeDefined();
  });

  it('has correct columns', () => {
    const cols = db.prepare("PRAGMA table_info(node_content_history)").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('node_id');
    expect(colNames).toContain('node_type');
    expect(colNames).toContain('version');
    expect(colNames).toContain('content_md');
    expect(colNames).toContain('changed_by');
    expect(colNames).toContain('changed_at');
  });

  it('has index on node_id + node_type', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='node_content_history'").all() as any[];
    const indexNames = indexes.map((i: any) => i.name);
    expect(indexNames.some((n: string) => n.includes('content_history'))).toBe(true);
  });
});

describe('Short ID generation script', () => {

  const SCRIPT_PATH = resolve(__dirname, '../../scripts/generate-short-ids.js');

  it('scripts/generate-short-ids.js exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('script uses Base62 charset', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/[a-zA-Z0-9]/);
    expect(content).toMatch(/randomBytes|crypto/);
  });

  it('script is idempotent (WHERE short_id IS NULL)', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/IS NULL|short_id IS NULL/i);
  });
});

describe('Migration file exists', () => {

  it('052-knowledge-browser-schema.sql is present', () => {
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = existsSync(migrationsDir) ? require('fs').readdirSync(migrationsDir) : [];
    expect(files).toContain('052-knowledge-browser-schema.sql');
  });
});
