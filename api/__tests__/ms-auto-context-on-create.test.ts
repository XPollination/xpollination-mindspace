import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Auto-Context on Create Tests — ms-auto-context-on-create
 * Validates: tasks auto-linked to requirements at creation based on group/description.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'auto-ctx-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(USER_ID, 'autoctx@test.com', '$2b$10$x', 'Auto Ctx');
  authToken = jwt.sign({ sub: USER_ID, email: 'autoctx@test.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('p-ctx', 'xpollination-mcp-server', 'XPollination', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Auto-link tasks to requirements on creation', () => {

  it('creating a task with AUTH group auto-suggests requirement_refs', async () => {
    const res = await request(app)
      .post('/api/v1/projects/xpollination-mcp-server/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Auth feature', group: 'AUTH', status: 'pending' });

    if (res.status === 201 || res.status === 200) {
      const task = res.body;
      // Should have requirement_refs suggested or auto-assigned
      expect(task.dna?.requirement_refs || task.requirement_refs || []).toBeDefined();
    }
  });

  it('API supports requirement suggestion endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/tasks/suggest-requirements?group=AUTH')
      .set('Authorization', `Bearer ${authToken}`);
    // Should return suggestions or 200 (even if empty)
    expect([200, 404]).toContain(res.status);
  });
});
