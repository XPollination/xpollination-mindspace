/**
 * TDD tests for h1-5-viz-mission-dashboard
 * Mission dashboard: batched API + viz capability cards with dependency graph.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type Database from 'better-sqlite3';
import request from 'supertest';

const VIZ_ROOT = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';

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

  // Mission
  db.prepare("INSERT INTO missions (id, title, status) VALUES ('mission-1', 'Test Mission', 'active')").run();

  // Capabilities with dependency_ids
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, dependency_ids, sort_order) VALUES ('cap-1', 'mission-1', 'Foundation', 'active', '[]', 1)").run();
  db.prepare("INSERT INTO capabilities (id, mission_id, title, status, dependency_ids, sort_order) VALUES ('cap-2', 'mission-1', 'Authentication', 'active', '[\"cap-1\"]', 2)").run();

  // Tasks linked via capability_tasks (uses task_slug)
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-1', 'test-proj', 'Task 1', 'complete', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO tasks (id, project_slug, title, status, current_role, created_by) VALUES ('task-2', 'test-proj', 'Task 2', 'active', 'dev', 'user-1')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 'task-1')").run();
  db.prepare("INSERT INTO capability_tasks (capability_id, task_slug) VALUES ('cap-1', 'task-2')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('Batched mission overview API', () => {
  it('GET /missions/:id/overview returns all capabilities with progress', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/missions/mission-1/overview')
      .set('Authorization', `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.capabilities).toBeDefined();
    expect(Array.isArray(res.body.capabilities)).toBe(true);
    expect(res.body.capabilities.length).toBe(2);
  });

  it('each capability includes progress_percent and task counts', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/missions/mission-1/overview')
      .set('Authorization', `Bearer ${apiKey}`);

    const cap = res.body.capabilities.find((c: any) => c.id === 'cap-1');
    expect(cap).toBeDefined();
    expect(typeof cap.progress_percent).toBe('number');
    expect(cap.progress_percent).toBe(50); // 1 complete out of 2 tasks
    expect(typeof cap.task_count).toBe('number');
    expect(cap.task_count).toBe(2);
  });

  it('each capability includes dependency_ids for graph rendering', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/missions/mission-1/overview')
      .set('Authorization', `Bearer ${apiKey}`);

    const capAuth = res.body.capabilities.find((c: any) => c.id === 'cap-2');
    expect(capAuth).toBeDefined();
    expect(capAuth.dependency_ids).toBeDefined();
    expect(capAuth.dependency_ids).toContain('cap-1');
  });
});

describe('Viz mission dashboard UI', () => {
  it('a viz version contains mission dashboard with capability cards', () => {
    // Check that some viz version after v0.0.15 contains mission-related UI
    const versions = ['v0.0.16', 'v0.0.17', 'v0.0.18', 'v0.0.19', 'v0.0.20'];
    let found = false;
    for (const v of versions) {
      const indexPath = resolve(VIZ_ROOT, `versions/${v}/index.html`);
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        if (content.match(/mission/i) && content.match(/capability|cap-card|dependency/i)) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });
});
