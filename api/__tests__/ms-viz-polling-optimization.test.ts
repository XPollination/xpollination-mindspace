/**
 * TDD tests for ms-viz-polling-optimization
 * ETag conditional fetching + adaptive polling for viz.
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

  db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES ('user-1', 'test@test.com', 'hash', 'Test User')").run();
  db.prepare("INSERT INTO projects (id, slug, name, created_by) VALUES ('proj-1', 'test-proj', 'Test Project', 'user-1')").run();
  db.prepare("INSERT INTO project_access (id, user_id, project_slug, role, granted_by) VALUES ('pa-1', 'user-1', 'test-proj', 'admin', 'user-1')").run();

  const crypto = await import('node:crypto');
  apiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  db.prepare("INSERT INTO api_keys (id, user_id, key_hash, name) VALUES ('key-1', 'user-1', ?, 'Test Key')").run(keyHash);
});

afterAll(() => {
  teardownTestDb();
});

describe('Server ETag support', () => {
  it('GET /api/data returns ETag header', async () => {
    const res = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${apiKey}`);

    // Should return ETag header (even if 200 or 404 for route)
    expect(res.headers['etag']).toBeDefined();
  });

  it('returns 304 Not Modified when ETag matches', async () => {
    const first = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${apiKey}`);

    const etag = first.headers['etag'];
    expect(etag).toBeDefined();

    const second = await request(app)
      .get('/api/data?project=test-proj')
      .set('Authorization', `Bearer ${apiKey}`)
      .set('If-None-Match', etag);

    expect(second.status).toBe(304);
  });
});

describe('Viz adaptive polling', () => {
  it('a viz version contains adaptive polling logic (idle detection)', () => {
    // Check viz versions for adaptive polling implementation
    const versions = ['v0.0.16', 'v0.0.17', 'v0.0.18', 'v0.0.19', 'v0.0.20'];
    let found = false;
    for (const v of versions) {
      const indexPath = resolve(VIZ_ROOT, `versions/${v}/index.html`);
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf-8');
        // Should have adaptive interval logic (idle detection or variable polling)
        if (content.match(/pollInterval|adaptiveP|idleT|If-None-Match/i)) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });
});
