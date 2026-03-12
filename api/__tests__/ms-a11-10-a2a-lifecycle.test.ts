/**
 * TDD tests for ms-a11-10-a2a-tests
 * A2A protocol integration: full agent lifecycle via SSE + API.
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

  // Seed: user, project, API key, agent, task
  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT INTO project_access (id, user_id, project_slug, role, granted_by) VALUES ('pa-1', 'user-1', 'test-proj', 'admin', 'user-1')").run();
  db.prepare("INSERT INTO agents (id, user_id, name, status) VALUES ('agent-1', 'user-1', 'PDSA Agent', 'active')").run();

  const crypto = await import('node:crypto');
  apiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  db.prepare("INSERT INTO api_keys (id, user_id, key_hash, name) VALUES ('key-1', 'user-1', ?, 'Test Key')").run(keyHash);

  // Task available for claiming
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-a2a', 'test-proj', 'A2A Test Task', 'ready', 'pdsa', 'user-1')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('A2A agent connect', () => {
  it('POST /agents/connect returns agent session with WELCOME', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/connect')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', role: 'pdsa' });

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBeDefined();
    expect(res.body.type).toBe('WELCOME');
  });
});

describe('A2A task claim', () => {
  it('POST /agents/claim-task claims a ready task for the agent', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/claim-task')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', task_id: 'task-a2a' });

    expect(res.status).toBe(200);
    expect(res.body.task_id).toBe('task-a2a');
    expect(res.body.status).toBe('active');
  });
});

describe('A2A heartbeat', () => {
  it('POST /agents/heartbeat renews agent session', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/heartbeat')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1' });

    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
  });
});

describe('A2A transition', () => {
  it('POST /agents/transition submits a task state transition', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/transition')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1', task_id: 'task-a2a', new_status: 'review' });

    expect(res.status).toBe(200);
    expect(res.body.transition).toBeDefined();
  });
});

describe('A2A disconnect', () => {
  it('POST /agents/disconnect cleans up agent session', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/agents/disconnect')
      .set('x-api-key', apiKey)
      .send({ agent_id: 'agent-1' });

    expect(res.status).toBe(200);

    // Agent status should be updated
    const agent = db.prepare("SELECT status FROM agents WHERE id = 'agent-1'").get() as any;
    expect(agent.status).toBe('disconnected');
  });
});
