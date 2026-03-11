/**
 * TDD tests for t3-6-deployment-gate
 * Deployment gate: blocks release sealing while suspect links exist.
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

  // Release
  db.prepare("INSERT INTO releases (id, project_slug, version, status, created_by) VALUES ('rel-1', 'test-proj', '1.0.0', 'draft', 'user-1')").run();

  // Suspect links (unresolved)
  db.prepare("INSERT INTO suspect_links (id, project_slug, source_type, source_ref, target_type, target_ref, reason, status) VALUES ('sl-1', 'test-proj', 'requirement', 'req-1', 'test', 'test-1', 'requirement changed', 'suspect')").run();

  // Feature flag
  db.prepare("INSERT INTO feature_flags (id, project_slug, flag_name, state) VALUES ('ff-1', 'test-proj', 'deployment_gate_enabled', 'on')").run();
});

afterAll(() => {
  teardownTestDb();
});

describe('Deployment gate on release sealing', () => {
  it('POST /:releaseId/seal returns 409 when unresolved suspect links exist', async () => {
    const res = await request(app)
      .post('/api/v1/projects/test-proj/releases/rel-1/seal')
      .set('x-api-key', apiKey);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/suspect|unresolved/i);
  });

  it('POST /:releaseId/seal succeeds when all suspect links are resolved', async () => {
    // Clear the suspect link
    db.prepare("UPDATE suspect_links SET status = 'cleared' WHERE id = 'sl-1'").run();

    const res = await request(app)
      .post('/api/v1/projects/test-proj/releases/rel-1/seal')
      .set('x-api-key', apiKey);

    expect(res.status).toBe(200);

    // Restore for other tests
    db.prepare("UPDATE suspect_links SET status = 'suspect' WHERE id = 'sl-1'").run();
    db.prepare("UPDATE releases SET status = 'draft' WHERE id = 'rel-1'").run();
  });
});

describe('Deployment readiness endpoint', () => {
  it('GET /deployment-readiness returns suspect counts and ready boolean', async () => {
    const res = await request(app)
      .get('/api/v1/projects/test-proj/deployment-readiness')
      .set('x-api-key', apiKey);

    expect(res.status).toBe(200);
    expect(typeof res.body.ready).toBe('boolean');
    expect(res.body.ready).toBe(false); // has open suspect links
    expect(typeof res.body.open_suspects).toBe('number');
    expect(res.body.open_suspects).toBeGreaterThan(0);
  });
});

describe('Feature flag bypass', () => {
  it('seal succeeds despite suspects when deployment_gate_enabled is false', async () => {
    db.prepare("UPDATE feature_flags SET state = 'off' WHERE flag_name = 'deployment_gate_enabled'").run();

    const res = await request(app)
      .post('/api/v1/projects/test-proj/releases/rel-1/seal')
      .set('x-api-key', apiKey);

    // Should succeed (gate bypassed)
    expect(res.status).toBe(200);

    // Restore
    db.prepare("UPDATE feature_flags SET state = 'on' WHERE flag_name = 'deployment_gate_enabled'").run();
    db.prepare("UPDATE releases SET status = 'draft' WHERE id = 'rel-1'").run();
  });
});
