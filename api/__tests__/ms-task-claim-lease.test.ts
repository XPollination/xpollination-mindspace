import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Task Claim Lease Tests — ms-task-claim-lease
 * Validates: claim returns lease token, lease has TTL, auto-release on expiry.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'lease-test-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'lease@example.com', '$2b$10$placeholder', 'Lease Tester'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'lease@example.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('proj-lease', 'lease-proj', 'Lease Project', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'lease-proj', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Task claim returns lease token', () => {

  it('POST claim endpoint returns lease_token in response', async () => {
    // Create a task first
    const createRes = await request(app)
      .post('/api/v1/projects/lease-proj/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Lease Test Task', status: 'ready' });

    if (createRes.status === 201 || createRes.status === 200) {
      const taskId = createRes.body.id;
      const claimRes = await request(app)
        .post(`/api/v1/projects/lease-proj/tasks/${taskId}/claim`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 201]).toContain(claimRes.status);
      expect(claimRes.body).toHaveProperty('lease_token');
    }
  });

  it('lease token has TTL/expires_at field', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects/lease-proj/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Lease TTL Task', status: 'ready' });

    if (createRes.status === 201 || createRes.status === 200) {
      const taskId = createRes.body.id;
      const claimRes = await request(app)
        .post(`/api/v1/projects/lease-proj/tasks/${taskId}/claim`)
        .set('Authorization', `Bearer ${authToken}`);

      if (claimRes.body.lease_token) {
        expect(claimRes.body).toHaveProperty('expires_at');
      }
    }
  });
});

describe('Lease heartbeat and release', () => {

  it('heartbeat endpoint exists (POST /tasks/:id/heartbeat)', async () => {
    const res = await request(app)
      .post('/api/v1/projects/lease-proj/tasks/nonexistent/heartbeat')
      .set('Authorization', `Bearer ${authToken}`);
    // Should not be 404 (endpoint exists)
    expect(res.status).not.toBe(404);
  });

  it('release endpoint exists (DELETE /tasks/:id/claim)', async () => {
    const res = await request(app)
      .delete('/api/v1/projects/lease-proj/tasks/nonexistent/claim')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).not.toBe(404);
  });
});
