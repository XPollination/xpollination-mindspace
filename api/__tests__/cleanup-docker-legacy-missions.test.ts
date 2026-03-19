import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Cleanup Docker Legacy Missions Tests — cleanup-docker-legacy-missions
 * Validates: Migration 055 cleans up legacy missions, docker-compose updated.
 * TDD: Dev creates migration 055 and updates docker-compose.prod.yml.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 055: Legacy mission cleanup', () => {

  it('no orphan capabilities (all have valid mission_id)', () => {
    const orphans = db.prepare("SELECT c.id FROM capabilities c LEFT JOIN missions m ON c.mission_id = m.id WHERE m.id IS NULL").all();
    expect(orphans.length).toBe(0);
  });

  it('3 PLATFORM-001 missions still exist', () => {
    const count = db.prepare("SELECT COUNT(*) as c FROM missions WHERE id IN ('mission-fair-attribution','mission-traversable-context','mission-agent-human-collab')").get() as any;
    expect(count.c).toBe(3);
  });
});

describe('Docker compose updated', () => {

  it('docker-compose.prod.yml exists', () => {
    const composePath = resolve(__dirname, '../../docker-compose.prod.yml');
    expect(existsSync(composePath)).toBe(true);
  });

  it('docker-compose.prod.yml does not define viz service', () => {
    const composePath = resolve(__dirname, '../../docker-compose.prod.yml');
    if (existsSync(composePath)) {
      const content = readFileSync(composePath, 'utf-8');
      // viz and api services should be removed (served by systemd now)
      expect(content).not.toMatch(/^\s+viz:/m);
    }
  });

  it('docker-compose.prod.yml keeps brain/qdrant services', () => {
    const composePath = resolve(__dirname, '../../docker-compose.prod.yml');
    if (existsSync(composePath)) {
      const content = readFileSync(composePath, 'utf-8');
      expect(content).toMatch(/brain|qdrant/i);
    }
  });
});

describe('Migration file exists', () => {

  it('055-cleanup-legacy-missions.sql is present', () => {
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = existsSync(migrationsDir) ? require('fs').readdirSync(migrationsDir) : [];
    expect(files).toContain('055-cleanup-legacy-missions.sql');
  });
});
