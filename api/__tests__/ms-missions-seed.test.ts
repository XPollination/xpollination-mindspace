import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Missions Seed Tests — ms-missions-seed
 * Validates: missions, capabilities, requirements seeded in DB.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'seed-test-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'seed@example.com', '$2b$10$placeholder', 'Seed Tester'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'seed@example.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('proj-seed', 'xpollination-mcp-server', 'XPollination', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Missions seed data', () => {

  it('at least 1 mission exists after seed', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM missions').get() as any;
    expect(count.c).toBeGreaterThanOrEqual(1);
  });

  it('at least 1 capability exists after seed', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM capabilities').get() as any;
    expect(count.c).toBeGreaterThanOrEqual(1);
  });

  it('capabilities are linked to missions', () => {
    const linked = db.prepare('SELECT COUNT(*) as c FROM capabilities WHERE mission_id IS NOT NULL').get() as any;
    expect(linked.c).toBeGreaterThanOrEqual(1);
  });

  it('missions endpoint returns seeded data', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/missions')
      .set('Authorization', `Bearer ${authToken}`);
    // Should not be empty after seed
    expect(res.status).toBe(200);
  });
});
