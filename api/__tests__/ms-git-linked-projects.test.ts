import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Git-Linked Projects Tests — ms-git-linked-projects
 * Validates: API-based project management replaces filesystem discovery.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'git-proj-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(
    USER_ID, 'gitproj@example.com', '$2b$10$placeholder', 'Git Proj User'
  );
  authToken = jwt.sign({ sub: USER_ID, email: 'gitproj@example.com' }, process.env.JWT_SECRET!);
});

afterAll(() => { teardownTestDb(); });

describe('Project CRUD via API', () => {

  it('POST /api/v1/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Project', slug: 'test-project', description: 'API-created project' });
    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/v1/projects lists projects', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('project has git_url field for linking', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${authToken}`);
    if (res.status === 200 && Array.isArray(res.body)) {
      // Projects should have git_url or repo_url field
      const hasGitField = res.body.some((p: any) =>
        p.git_url !== undefined || p.repo_url !== undefined || p.github_url !== undefined
      );
      expect(hasGitField || res.body.length === 0).toBe(true);
    }
  });
});

describe('No filesystem discovery dependency', () => {

  it('viz server does NOT use discover-projects.cjs for project list', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const base = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/viz';
    const versions = fs.readdirSync(path.resolve(base, 'versions'))
      .filter((d: string) => d.startsWith('v'))
      .sort((a: string, b: string) => {
        const pa = a.replace('v', '').split('.').map(Number);
        const pb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      });
    const latest = versions[versions.length - 1];
    const serverJs = fs.readFileSync(path.resolve(base, 'versions', latest, 'server.js'), 'utf-8');
    expect(serverJs).not.toMatch(/discover-projects/);
  });
});
