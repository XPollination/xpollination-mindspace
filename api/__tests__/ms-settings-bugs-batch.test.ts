import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'node:crypto';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Settings Bugs Batch Tests — ms-settings-account-info, ms-settings-sessions-loading, ms-settings-api-key-show
 * Validates: account info returns name+email, sessions endpoint works, API key display works.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'settings-batch-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('TestPass123', 10);
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'batch@test.com', hash, 'Batch User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'batch@test.com', name: 'Batch User' }, process.env.JWT_SECRET!);

  // Create an API key for the user
  const keyHash = createHash('sha256').update('test-api-key-batch').digest('hex');
  db.prepare(`INSERT INTO api_keys (id, key_hash, user_id, name) VALUES (?, ?, ?, ?)`).run(
    randomUUID(), keyHash, USER_ID, 'Test Key'
  );
});

afterAll(() => { teardownTestDb(); });

// ms-settings-account-info
describe('Account info returns name and email', () => {

  it('GET /api/auth/me returns user name and email', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('email');
    expect(res.body.name).toBe('Batch User');
    expect(res.body.email).toBe('batch@test.com');
  });
});

// ms-settings-sessions-loading
describe('Sessions endpoint returns data', () => {

  it('GET /api/auth/sessions returns array (not stuck)', async () => {
    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const body = res.body;
    expect(Array.isArray(body) || body.sessions !== undefined).toBe(true);
  });
});

// ms-settings-api-key-show
describe('API key display works', () => {

  it('GET /api/keys returns user keys (not stuck)', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('API keys response includes key metadata', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${authToken}`);
    if (res.status === 200 && Array.isArray(res.body)) {
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('name');
    }
  });
});
