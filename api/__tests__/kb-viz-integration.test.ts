import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * KB Viz Integration Tests — kb-viz-integration
 * Validates: Dashboard links to knowledge browser, KB links back to dashboard.
 * TDD: Dev adds short_id to API, wraps names in anchor tags, adds View Tasks link.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Mission-overview API includes short_id', () => {

  it('missions have short_id in database', () => {
    const missions = db.prepare("SELECT id, short_id FROM missions WHERE id LIKE 'mission-%'").all() as any[];
    // After migration 052+generate, short_ids should exist
    // TDD: will fail if short_ids not generated yet
    const withShortId = missions.filter((m: any) => m.short_id);
    expect(withShortId.length).toBeGreaterThanOrEqual(3);
  });

  it('capabilities have short_id in database', () => {
    const caps = db.prepare("SELECT id, short_id FROM capabilities WHERE id LIKE 'cap-%'").all() as any[];
    const withShortId = caps.filter((c: any) => c.short_id);
    expect(withShortId.length).toBeGreaterThanOrEqual(9);
  });
});

describe('Server includes short_id in mission-overview response', () => {

  it('mission-overview query selects short_id', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/short_id.*FROM missions|SELECT.*short_id.*missions/i);
  });

  it('capability query selects short_id', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/short_id.*FROM capabilities|SELECT.*short_id.*capabilities/i);
  });
});

describe('Dashboard names link to knowledge browser', () => {

  it('mission names wrapped in anchor tags with /m/ URL', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    // The viz HTML template should generate <a href="/m/..."> links
    expect(content).toMatch(/href.*\/m\/|<a.*mission.*short_id/i);
  });
});

describe('KB pages link back to dashboard', () => {

  it('renderNodePage includes View Tasks or dashboard link', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/View Tasks|dashboard|kanban|back.*tasks/i);
  });
});
