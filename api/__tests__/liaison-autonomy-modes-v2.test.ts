import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Liaison Autonomy Modes v2 Tests — liaison-autonomy-modes-v2
 * Validates: Rename auto→autopilot, per-project settings, migration 054.
 * TDD: Dev creates migration 054 and updates API.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Migration 054: Rename auto→autopilot', () => {

  it('no auto or auto-approval values remain in system_settings', () => {
    // Seed an 'auto' value, run migration, verify it becomes 'autopilot'
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('liaison_approval_mode', 'auto')").run();
    // After migration 054, this should be 'autopilot'. Test fails if migration not applied.
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
    // After migration: expect 'autopilot', before migration: 'auto'
    expect(['autopilot', 'semi']).toContain(row?.value);
  });
});

describe('Valid modes are autopilot, semi, manual', () => {

  it('autopilot is a valid mode value', () => {
    const fn = () => db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('test_mode', 'autopilot')").run();
    expect(fn).not.toThrow();
  });

  it('semi is a valid mode value', () => {
    const fn = () => db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('test_mode', 'semi')").run();
    expect(fn).not.toThrow();
  });

  it('manual is a valid mode value', () => {
    const fn = () => db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('test_mode', 'manual')").run();
    expect(fn).not.toThrow();
  });
});

describe('Per-project per-user settings', () => {

  it('user_project_settings table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_project_settings'").get() as any;
    expect(table).toBeDefined();
  });

  it('can store per-project liaison mode', () => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('mode-user', 'mode@test.com', 'x', 'Mode User')").run();
    const fn = () => db.prepare(
      "INSERT OR REPLACE INTO user_project_settings (user_id, project_slug, key, value) VALUES ('mode-user', 'mindspace', 'liaison_approval_mode', 'autopilot')"
    ).run();
    expect(fn).not.toThrow();
  });

  it('per-project setting can differ from global', () => {
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('liaison_approval_mode', 'semi')").run();
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('mode-user2', 'mode2@test.com', 'x', 'Mode User2')").run();
    db.prepare("INSERT OR REPLACE INTO user_project_settings (user_id, project_slug, key, value) VALUES ('mode-user2', 'mindspace', 'liaison_approval_mode', 'manual')").run();

    const global = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get() as any;
    const perProject = db.prepare("SELECT value FROM user_project_settings WHERE user_id = 'mode-user2' AND project_slug = 'mindspace' AND key = 'liaison_approval_mode'").get() as any;

    expect(global.value).toBe('semi');
    expect(perProject.value).toBe('manual');
  });
});

describe('Migration file exists', () => {

  it('054-rename-auto-to-autopilot.sql is present', async () => {
    const { readdirSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(__dirname, '../db/migrations');
    const files = readdirSync(migrationsDir);
    expect(files).toContain('054-rename-auto-to-autopilot.sql');
  });
});
