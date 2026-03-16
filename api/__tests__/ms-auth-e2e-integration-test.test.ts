import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'node:crypto';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * E2E Auth Integration Test — ms-auth-e2e-integration-test
 * Full flow from registration to login to data access to logout.
 * 12 test scenarios from DNA.
 */

let app: Express;
let db: Database.Database;

const ADMIN_USER_ID = 'admin-user-id';
const VALID_INVITE_CODE = 'VALID-INVITE-001';
const EXPIRED_INVITE_CODE = 'EXPIRED-INVITE-001';
const USED_INVITE_CODE = 'USED-INVITE-001';
const TEST_API_KEY = 'test-api-key-for-cli';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  // Create admin user (Thomas) with password
  const bcrypt = await import('bcryptjs');
  const adminHash = await bcrypt.hash('AdminPass123', 10);
  db.prepare(`INSERT INTO users (id, email, password_hash, name, invite_quota) VALUES (?, ?, ?, ?, ?)`).run(
    ADMIN_USER_ID, 'thomas@example.com', adminHash, 'Thomas', 10
  );

  // Create project for data access tests
  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('proj-e2e', 'e2e-project', 'E2E Project', 'Test', ?)`).run(ADMIN_USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'e2e-project', 'admin', ?)`).run(ADMIN_USER_ID, ADMIN_USER_ID);

  // Create valid invite
  db.prepare(`INSERT INTO invites (id, code, created_by) VALUES (?, ?, ?)`).run(
    randomUUID(), VALID_INVITE_CODE, ADMIN_USER_ID
  );

  // Create expired invite
  db.prepare(`INSERT INTO invites (id, code, created_by, expires_at) VALUES (?, ?, ?, datetime('now', '-1 day'))`).run(
    randomUUID(), EXPIRED_INVITE_CODE, ADMIN_USER_ID
  );

  // Create used invite
  db.prepare(`INSERT INTO invites (id, code, created_by, used_by) VALUES (?, ?, ?, ?)`).run(
    randomUUID(), USED_INVITE_CODE, ADMIN_USER_ID, ADMIN_USER_ID
  );

  // Create API key for CLI access tests (key_hash = SHA-256 of the raw key)
  const keyHash = createHash('sha256').update(TEST_API_KEY).digest('hex');
  db.prepare(`INSERT INTO api_keys (id, key_hash, user_id, name) VALUES (?, ?, ?, ?)`).run(
    randomUUID(), keyHash, ADMIN_USER_ID, 'CLI Key'
  );
});

afterAll(() => {
  teardownTestDb();
});

// T1: Unauthenticated access to data → 401
describe('T1: Unauthenticated API access', () => {
  it('GET /api/data without token returns 401', async () => {
    const res = await request(app).get('/api/data?project=e2e-project');
    expect(res.status).toBe(401);
  });
});

// T2: Unauthenticated access to projects → 401
describe('T2: Unauthenticated project access', () => {
  it('GET /api/v1/projects without token returns 401', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });
});

// T3: Unauthenticated access to tasks → 401
describe('T3: Unauthenticated tasks access', () => {
  it('GET /api/v1/projects/e2e-project/tasks without token returns 401', async () => {
    const res = await request(app).get('/api/v1/projects/e2e-project/tasks');
    expect(res.status).toBe(401);
  });
});

// T4: Registration with valid invite → auto-login
describe('T4: Registration with valid invite', () => {
  let registerRes: any;

  it('POST /api/auth/register with valid invite returns 201', async () => {
    registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'maria@example.com',
        name: 'Maria',
        password: 'MariaPass123',
        invite_code: VALID_INVITE_CODE
      });
    expect(registerRes.status).toBe(201);
    expect(registerRes.body).toHaveProperty('id');
    expect(registerRes.body.email).toBe('maria@example.com');
  });
});

// T5: Invite consumed after registration
describe('T5: Invite consumed', () => {
  it('invite code is marked as used after registration', () => {
    const invite = db.prepare(`SELECT used_by FROM invites WHERE code = ?`).get(VALID_INVITE_CODE) as any;
    expect(invite.used_by).not.toBeNull();
  });
});

// T6: Login with registered credentials
describe('T6: Login with credentials', () => {
  let loginToken: string;

  it('POST /api/auth/login returns token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maria@example.com', password: 'MariaPass123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    loginToken = res.body.token;
  });

  it('authenticated user can access /api/data', async () => {
    // Need to grant project access to Maria first
    const maria = db.prepare(`SELECT id FROM users WHERE email = 'maria@example.com'`).get() as any;
    db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'e2e-project', 'viewer', ?)`).run(maria.id, ADMIN_USER_ID);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maria@example.com', password: 'MariaPass123' });
    loginToken = loginRes.body.token;

    const res = await request(app)
      .get('/api/data?project=e2e-project')
      .set('Authorization', `Bearer ${loginToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
  });
});

// T7: Logout → data access revoked (JWT-based, so "logout" = no token)
describe('T7: Without token after logout', () => {
  it('GET /api/data without token returns 401', async () => {
    const res = await request(app).get('/api/data?project=e2e-project');
    expect(res.status).toBe(401);
  });
});

// T8: Login with admin credentials → dashboard accessible
describe('T8: Admin login and data access', () => {
  it('admin can login and see data', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'thomas@example.com', password: 'AdminPass123' });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body.token;
    const dataRes = await request(app)
      .get('/api/data?project=e2e-project')
      .set('Authorization', `Bearer ${token}`);
    expect(dataRes.status).toBe(200);
  });
});

// T9: API key auth for CLI
describe('T9: API key auth for CLI', () => {
  it('X-API-Key header grants access to /api/data', async () => {
    const res = await request(app)
      .get('/api/data?project=e2e-project')
      .set('X-API-Key', TEST_API_KEY);
    expect(res.status).toBe(200);
  });
});

// T10: Invalid invite code → rejected
describe('T10: Invalid invite code', () => {
  it('registration with invalid invite returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'hacker@example.com',
        name: 'Hacker',
        password: 'HackerPass123',
        invite_code: 'INVALID-CODE-999'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid invite/i);
  });
});

// T11: Expired invite → rejected
describe('T11: Expired invite code', () => {
  it('registration with expired invite returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'late@example.com',
        name: 'Late User',
        password: 'LatePass123',
        invite_code: EXPIRED_INVITE_CODE
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// T12: Registration without invite → rejected
describe('T12: Registration without invite', () => {
  it('registration without invite_code returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'no-invite@example.com',
        name: 'No Invite',
        password: 'NoInvitePass123'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invite_code.*required/i);
  });
});
