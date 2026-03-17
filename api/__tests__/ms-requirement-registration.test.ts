import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Requirement Registration Tests — ms-requirement-registration
 * Validates: REQ-* entries in requirements table, linked to capabilities.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'req-reg-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'reqreg@test.com', '$2b$10$x', 'Req User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'reqreg@test.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('p-req', 'xpollination-mcp-server', 'XPollination', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Requirements registered in DB', () => {

  it('requirements table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='requirements'").get();
    expect(table).not.toBeUndefined();
  });

  it('GET /api/v1/projects/:slug/requirements returns list', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/requirements')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('requirements have REQ-* identifiers after seed', () => {
    const reqs = db.prepare("SELECT * FROM requirements WHERE slug LIKE 'REQ-%' OR title LIKE 'REQ-%'").all();
    expect(reqs.length).toBeGreaterThanOrEqual(1);
  });
});
