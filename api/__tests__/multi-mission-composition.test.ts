import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * Multi-Mission Composition Tests — multi-mission-composition-test
 * Validates: Capabilities can be composed by multiple missions via relationships.
 * TDD: Tests for multi-parent queries and cross-reference rendering.
 * Ref: REQ-OG-002, migration 059
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('CAP-AUTH multi-mission: specific relationship pairs', () => {

  it('CAP-AUTH has COMPOSES relationship to mission-agent-human-collab', () => {
    const rel = db.prepare(
      "SELECT * FROM node_relationships WHERE source_id = 'cap-auth' AND relation = 'COMPOSES' AND target_id = 'mission-agent-human-collab'"
    ).get();
    expect(rel).toBeDefined();
  });

  it('CAP-AUTH has COMPOSES relationship to mission-fair-attribution', () => {
    const rel = db.prepare(
      "SELECT * FROM node_relationships WHERE source_id = 'cap-auth' AND relation = 'COMPOSES' AND target_id = 'mission-fair-attribution'"
    ).get();
    expect(rel).toBeDefined();
  });

  it('CAP-AUTH has exactly 2 COMPOSES relationships to missions', () => {
    const rels = db.prepare(
      "SELECT * FROM node_relationships WHERE source_type = 'capability' AND source_id = 'cap-auth' AND relation = 'COMPOSES' AND target_type = 'mission'"
    ).all();
    expect(rels.length).toBe(2);
  });
});

describe('Multi-parent query: get all parent missions for a capability', () => {

  it('query via node_relationships returns both parent missions for cap-auth', () => {
    const parents = db.prepare(
      "SELECT nr.target_id, m.title FROM node_relationships nr JOIN missions m ON nr.target_id = m.id WHERE nr.source_type = 'capability' AND nr.source_id = 'cap-auth' AND nr.relation = 'COMPOSES' AND nr.target_type = 'mission'"
    ).all() as any[];
    expect(parents.length).toBe(2);
    const missionIds = parents.map(p => p.target_id);
    expect(missionIds).toContain('mission-agent-human-collab');
    expect(missionIds).toContain('mission-fair-attribution');
  });

  it('single-mission capabilities have exactly 1 parent', () => {
    const parents = db.prepare(
      "SELECT * FROM node_relationships WHERE source_type = 'capability' AND source_id = 'cap-viz' AND relation = 'COMPOSES' AND target_type = 'mission'"
    ).all();
    expect(parents.length).toBe(1);
  });

  it('reverse query: mission-fair-attribution composes cap-auth', () => {
    const rel = db.prepare(
      "SELECT * FROM node_relationships WHERE source_type = 'mission' AND source_id = 'mission-fair-attribution' AND relation = 'COMPOSES' AND target_type = 'capability' AND target_id = 'cap-auth'"
    ).get();
    expect(rel).toBeDefined();
  });
});

describe('Cross-reference rendering in viz/server.js', () => {

  it('renderNodePage queries node_relationships for cross-references', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/node_relationships/);
  });

  it('capability page shows cross-references section for multi-mission', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/cross.?ref|related.?missions|also.?serves|composed.?by/i);
  });

  it('breadcrumb includes multi-mission indicator', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/\+\d|multi.?mission|additional.?mission/i);
  });
});

describe('Migration 059 idempotency', () => {

  it('re-running seed INSERT OR IGNORE does not create duplicates', () => {
    const countBefore = (db.prepare("SELECT COUNT(*) as c FROM node_relationships").get() as any).c;
    const migrationPath = resolve(__dirname, '../db/migrations/059-seed-relationships-from-fks.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    db.exec(sql);
    const countAfter = (db.prepare("SELECT COUNT(*) as c FROM node_relationships").get() as any).c;
    expect(countAfter).toBe(countBefore);
  });
});
