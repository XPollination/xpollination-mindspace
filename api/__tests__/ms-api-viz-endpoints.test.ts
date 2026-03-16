import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

let app: Express;
let db: Database.Database;
let authToken: string;

const TEST_USER_ID = 'viz-test-user-id';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  // Create user directly in DB (bypass invite-only registration)
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    TEST_USER_ID, 'viz-test@example.com', '$2b$10$placeholder', 'Viz Test'
  );

  // Generate JWT directly (auth middleware uses 'sub' for user id)
  authToken = jwt.sign({ sub: TEST_USER_ID, email: 'viz-test@example.com', name: 'Viz Test' }, process.env.JWT_SECRET!);

  // Create a test project and grant access
  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'Test', ?)`).run(TEST_USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'test-proj', 'admin', ?)`).run(TEST_USER_ID, TEST_USER_ID);
});

afterAll(() => {
  teardownTestDb();
});

// ==========================================================================
// 1. /api/data endpoint — must be wired in server.ts
// ==========================================================================

describe('/api/data endpoint wiring', () => {

  it('GET /api/data without auth returns 401', async () => {
    const res = await request(app).get('/api/data?project=test-proj');
    expect(res.status).toBe(401);
  });

  it('GET /api/data with auth returns project data', async () => {
    const res = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('project_slug', 'test-proj');
    expect(res.body).toHaveProperty('tasks');
    expect(res.body).toHaveProperty('exported_at');
  });

  it('GET /api/data returns ETag header', async () => {
    const res = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('etag');
  });

  it('GET /api/data with matching ETag returns 304', async () => {
    // First request to get ETag
    const first = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${authToken}`);
    const etag = first.headers['etag'];

    // Second request with If-None-Match
    const second = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${authToken}`)
      .set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });

  it('GET /api/data without project param returns 400', async () => {
    const res = await request(app)
      .get('/api/data')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/data with unknown project returns 404', async () => {
    const res = await request(app)
      .get('/api/data?project=nonexistent')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ==========================================================================
// 2. Settings endpoint — liaison-approval-mode read/write
// ==========================================================================

describe('/api/settings endpoint', () => {

  it('GET /api/settings/liaison-approval-mode returns current mode', async () => {
    const res = await request(app)
      .get('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode');
    expect(['auto', 'semi', 'manual']).toContain(res.body.mode);
  });

  it('PUT /api/settings/liaison-approval-mode updates mode', async () => {
    const res = await request(app)
      .put('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ mode: 'semi' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode', 'semi');
  });

  it('PUT /api/settings/liaison-approval-mode rejects invalid mode', async () => {
    const res = await request(app)
      .put('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ mode: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('GET /api/settings/liaison-approval-mode without auth returns 401', async () => {
    const res = await request(app)
      .get('/api/settings/liaison-approval-mode');
    expect(res.status).toBe(401);
  });
});

// ==========================================================================
// 3. Task routes — accessible under /api/projects/:slug/tasks (already nested)
// ==========================================================================

describe('Task routes under projects', () => {

  it('GET /api/v1/projects/test-proj/tasks returns task list', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/tasks')
      .set('Authorization', `Bearer ${authToken}`);
    // Should return 200 with task array (may be empty)
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) || res.body.tasks !== undefined).toBe(true);
  });
});

// ==========================================================================
// 4. Capabilities route — accessible under /api/projects/:slug/capabilities
// ==========================================================================

describe('Capabilities route under projects', () => {

  it('GET /api/v1/projects/test-proj/capabilities returns capability list', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/capabilities')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

// ==========================================================================
// 5. Missions route — accessible under /api/projects/:slug/missions
// ==========================================================================

describe('Missions route under projects', () => {

  it('GET /api/v1/projects/test-proj/missions returns mission list', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/missions')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

// ==========================================================================
// 6. Requirements route — accessible under /api/projects/:slug/requirements
// ==========================================================================

describe('Requirements route under projects', () => {

  it('GET /api/v1/projects/test-proj/requirements returns requirement list', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/requirements')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});
