/**
 * TDD tests for h1-8-agent-welcome-capability
 * Agent WELCOME enrichment: include capability context in connect response.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type Database from 'better-sqlite3';
import request from 'supertest';

let db: Database.Database;
let app: any;
let apiKey: string;

beforeAll(async () => {
  const result = await createTestApp();
  db = result.db;
  app = result.app;

  // Seed: user, project, API key
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT INTO project_access (id, user_id, project_slug, role, granted_by) VALUES ('pa-1', 'user-1', 'test-proj', 'admin', 'user-1')").run();

  const crypto = await import('node:crypto');
  apiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  db.prepare("INSERT INTO api_keys (id, user_id, key_hash, name) VALUES ('key-1', 'user-1', ?, 'Test Key')").run(keyHash);

  // Agent
  db.prepare("INSERT INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'PDSA Agent', 'active')").run();

  // Mission + capabilities
  db.prepare("INSERT INTO missions (id, title, status) VALUES ('mission-1', 'Test Mission', 'active')").run();
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, sort_order) VALUES ('cap-1', 'mission-1', 'Foundation', 'active', 1)").run();
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, sort_order) VALUES ('cap-2', 'mission-1', 'Auth', 'active', 2)").run();

  // Tasks linked to capabilities
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Task 1', 'complete', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-2', 'test-proj', 'Task 2', 'active', 'pdsa', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-3', 'test-proj', 'Task 3', 'complete', 'dev', 'user-1')").run();

  // Link tasks to capabilities
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 'task-1')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 'task-2')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-2', 'task-3')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('WELCOME response includes capability context', () => {
  it('POST /agents/connect returns context field with mission and capabilities', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/connect')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', role: 'pdsa' });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('WELCOME');
    expect(res.body.context).toBeDefined();
    expect(res.body.context.mission).toBeDefined();
    expect(res.body.context.mission.title).toBe('Test Mission');
  });

  it('context includes capabilities with progress_percent', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/connect')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', role: 'pdsa' });

    expect(res.status).toBe(200);
    const caps = res.body.context.capabilities;
    expect(Array.isArray(caps)).toBe(true);
    expect(caps.length).toBeGreaterThanOrEqual(2);

    const cap1 = caps.find((c: any) => c.title === 'Foundation');
    expect(cap1).toBeDefined();
    expect(typeof cap1.progress_percent).toBe('number');
    // cap-1 has 1 complete + 1 active = 50%
    expect(cap1.progress_percent).toBe(50);

    const cap2 = caps.find((c: any) => c.title === 'Auth');
    expect(cap2).toBeDefined();
    // cap-2 has 1 complete = 100%
    expect(cap2.progress_percent).toBe(100);
  });

  it('context includes pending_tasks for the connecting agent role', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/connect')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', role: 'pdsa' });

    expect(res.status).toBe(200);
    expect(typeof res.body.context.pending_tasks).toBe('number');
    // task-2 is active+pdsa — counts as pending for pdsa role
    expect(res.body.context.pending_tasks).toBeGreaterThanOrEqual(1);
  });
});
