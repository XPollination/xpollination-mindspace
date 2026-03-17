import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Settings Page Bugs Tests — ms-settings-page-bugs
 * Validates: change password endpoint, API key display, sessions list.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'settings-bug-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('OldPass123', 10);
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'settings-bug@test.com', hash, 'Settings Bug User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'settings-bug@test.com' }, process.env.JWT_SECRET!);
});

afterAll(() => { teardownTestDb(); });

describe('Bug 1: Change password endpoint works', () => {

  it('POST /api/auth/change-password returns 200 with valid data', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ current_password: 'OldPass123', new_password: 'NewPass456' });
    expect(res.status).toBe(200);
  });

  it('POST /api/auth/change-password returns proper JSON (not network error)', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ current_password: 'NewPass456', new_password: 'AnotherPass789' });
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('Bug 2: API key display works', () => {

  it('GET /api/keys returns user API keys (not stuck on Loading)', async () => {
    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('Bug 3: Sessions list works', () => {

  it('GET /api/auth/sessions returns session list (not stuck on Loading)', async () => {
    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
