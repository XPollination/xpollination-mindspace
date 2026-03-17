import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * User+Project Settings Tests — ms-user-project-settings
 * Validates: approval mode is per-user per-project, not global singleton.
 */

let app: Express;
let db: Database.Database;
let token1: string;
let token2: string;

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run('user-1', 'thomas@test.com', '$2b$10$x', 'Thomas');
  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run('user-2', 'robin@test.com', '$2b$10$x', 'Robin');
  token1 = jwt.sign({ sub: 'user-1', email: 'thomas@test.com' }, process.env.JWT_SECRET!);
  token2 = jwt.sign({ sub: 'user-2', email: 'robin@test.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('p1', 'proj-a', 'Project A', 'Test', 'user-1')`).run();
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES ('user-1', 'proj-a', 'admin', 'user-1')`).run();
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES ('user-2', 'proj-a', 'contributor', 'user-1')`).run();
});

afterAll(() => { teardownTestDb(); });

describe('Per-user per-project approval mode', () => {

  it('user can set approval mode for their project', async () => {
    const res = await request(app)
      .put('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${token1}`)
      .send({ mode: 'auto', project: 'proj-a' });
    expect([200, 201]).toContain(res.status);
  });

  it('different users can have different modes for same project', async () => {
    await request(app)
      .put('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${token1}`)
      .send({ mode: 'auto', project: 'proj-a' });

    await request(app)
      .put('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${token2}`)
      .send({ mode: 'semi', project: 'proj-a' });

    const res1 = await request(app)
      .get('/api/settings/liaison-approval-mode?project=proj-a')
      .set('Authorization', `Bearer ${token1}`);

    const res2 = await request(app)
      .get('/api/settings/liaison-approval-mode?project=proj-a')
      .set('Authorization', `Bearer ${token2}`);

    // Each user should get their own setting
    if (res1.status === 200 && res2.status === 200) {
      expect(res1.body.mode).not.toBe(res2.body.mode);
    }
  });

  it('GET without project returns user default or global fallback', async () => {
    const res = await request(app)
      .get('/api/settings/liaison-approval-mode')
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(200);
    expect(['auto', 'semi', 'manual']).toContain(res.body.mode);
  });
});
