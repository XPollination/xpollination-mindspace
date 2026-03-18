import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Google OAuth 500 Fix Tests — fix-google-oauth-500
 * Validates: OAuth routes handle missing strategy gracefully (503 not 500).
 * TDD: Dev fixes auth route to guard against uninitialized passport strategy.
 */

let app: Express;
let db: Database.Database;

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;
});

afterAll(() => { teardownTestDb(); });

describe('Google OAuth route behavior', () => {

  it('GET /api/auth/oauth/google does not return 500', async () => {
    const res = await request(app).get('/api/auth/oauth/google');
    // Should be 302 (redirect), 503 (unavailable), or 404 — NOT 500
    expect(res.status).not.toBe(500);
  });

  it('returns 503 or redirect when OAuth not configured', async () => {
    // In test env without Google credentials, should gracefully handle
    const res = await request(app).get('/api/auth/oauth/google');
    // 503 = strategy not registered, 302 = redirect to Google, 404 = route not found
    expect([302, 404, 503]).toContain(res.status);
  });

  it('GET /api/auth/oauth/google/callback does not return 500', async () => {
    const res = await request(app).get('/api/auth/oauth/google/callback');
    expect(res.status).not.toBe(500);
  });
});

describe('Users table supports OAuth', () => {

  it('users table has google_id column', () => {
    const cols = db.prepare("PRAGMA table_info(users)").all() as any[];
    const googleIdCol = cols.find((c: any) => c.name === 'google_id');
    expect(googleIdCol).toBeDefined();
  });
});

describe('Auth route error handling', () => {

  it('invalid OAuth provider returns appropriate error', async () => {
    const res = await request(app).get('/api/auth/oauth/nonexistent');
    // Should be 404 not 500
    expect(res.status).not.toBe(500);
  });
});
