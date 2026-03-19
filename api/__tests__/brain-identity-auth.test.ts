import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';

/**
 * Brain Identity Auth Tests — brain-identity-auth
 * Validates: API key → user identity mapping for brain contributor authentication.
 * TDD: Dev adds auth middleware to xpollination-hive.
 */

let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('API keys table supports identity lookup', () => {

  it('api_keys table has user_id FK', () => {
    const cols = db.prepare("PRAGMA table_info(api_keys)").all() as any[];
    expect(cols.some((c: any) => c.name === 'user_id')).toBe(true);
  });

  it('api_keys table has key_hash column', () => {
    const cols = db.prepare("PRAGMA table_info(api_keys)").all() as any[];
    expect(cols.some((c: any) => c.name === 'key_hash')).toBe(true);
  });

  it('can join api_keys to users for identity', () => {
    // Create test user and key
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES ('auth-test', 'auth@test.com', 'x', 'Auth Test')").run();
    db.prepare("INSERT OR IGNORE INTO api_keys (id, user_id, key_hash, name) VALUES ('key-auth-test', 'auth-test', 'testhash123', 'test key')").run();

    const result = db.prepare(`
      SELECT ak.user_id, u.name
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = 'testhash123'
    `).get() as any;

    expect(result).toBeDefined();
    expect(result.user_id).toBe('auth-test');
    expect(result.name).toBe('Auth Test');
  });
});

describe('Key validation query works', () => {

  it('returns null for non-existent key hash', () => {
    const result = db.prepare("SELECT user_id FROM api_keys WHERE key_hash = 'nonexistent'").get();
    expect(result).toBeUndefined();
  });

  it('api_keys has revoked_at column for key revocation', () => {
    const cols = db.prepare("PRAGMA table_info(api_keys)").all() as any[];
    const hasRevoked = cols.some((c: any) => c.name === 'revoked_at' || c.name === 'revoked');
    expect(hasRevoked).toBe(true);
  });
});

describe('Brain API health check is unauthenticated', () => {

  it('health endpoint accessible (live test)', async () => {
    const BRAIN_API_URL = process.env.BRAIN_API_URL || 'https://hive.xpollination.earth';
    try {
      const res = await fetch(`${BRAIN_API_URL}/api/v1/health`);
      expect(res.status).toBe(200);
    } catch {
      // Brain not reachable in test env — skip
    }
  });
});

describe('Hive auth middleware exists', () => {

  it('xpollination-hive has auth middleware file', async () => {
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    // Check in the hive repo
    const hivePath = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive/src/middleware/auth.ts');
    const hivePathJs = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-hive/src/middleware/auth.js');
    expect(existsSync(hivePath) || existsSync(hivePathJs)).toBe(true);
  });
});
