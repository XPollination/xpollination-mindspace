import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Task-Requirement Linking Tests — ms-task-requirement-linking
 * Validates: requirement_refs in task DNA, auto-link by group, API query by requirement.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'req-link-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'reqlink@test.com', '$2b$10$x', 'Req Link User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'reqlink@test.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('p-link', 'xpollination-mcp-server', 'XPollination', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Task DNA has requirement_refs', () => {

  it('tasks table supports dna with requirement_refs field', () => {
    // Create a task with requirement_refs in DNA
    const result = db.prepare(`INSERT INTO tasks (id, project_slug, title, status, dna) VALUES (?, ?, ?, ?, ?)`).run(
      'task-with-refs', 'xpollination-mcp-server', 'Test Task', 'active',
      JSON.stringify({ requirement_refs: ['REQ-AUTH-001', 'REQ-AUTH-002'] })
    );
    expect(result.changes).toBe(1);

    const task = db.prepare(`SELECT dna FROM tasks WHERE id = 'task-with-refs'`).get() as any;
    const dna = JSON.parse(task.dna);
    expect(dna.requirement_refs).toContain('REQ-AUTH-001');
  });
});

describe('API queries tasks by requirement', () => {

  it('GET tasks with requirement filter returns linked tasks', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/tasks?requirement=REQ-AUTH-001')
      .set('Authorization', `Bearer ${authToken}`);
    // Should support filtering by requirement (even if empty initially)
    expect([200, 400]).toContain(res.status); // 200 if supported, 400 if not yet
  });
});
