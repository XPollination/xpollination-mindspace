import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Hierarchy Example Data Tests — ms-hierarchy-example-data
 * Validates: Mission→Capability→Requirement→Task graph populated with ROAD-001/002/003 data.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'hier-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  db.prepare(`INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)`).run(USER_ID, 'hier@test.com', '$2b$10$x', 'Hier User');
  authToken = jwt.sign({ sub: USER_ID, email: 'hier@test.com' }, process.env.JWT_SECRET!);

  db.prepare(`INSERT INTO projects (id, slug, name, description, created_by) VALUES ('p-hier', 'xpollination-mcp-server', 'XPollination', 'Test', ?)`).run(USER_ID);
  db.prepare(`INSERT INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)`).run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Hierarchy graph has example data', () => {

  it('missions table has ROAD-001 or similar entries', () => {
    const missions = db.prepare("SELECT * FROM missions WHERE title LIKE '%ROAD%' OR slug LIKE '%road%'").all();
    expect(missions.length).toBeGreaterThanOrEqual(1);
  });

  it('capabilities linked to missions', () => {
    const caps = db.prepare("SELECT COUNT(*) as c FROM capabilities WHERE mission_id IS NOT NULL").get() as any;
    expect(caps.c).toBeGreaterThanOrEqual(1);
  });

  it('requirements linked to capabilities', () => {
    const reqs = db.prepare("SELECT COUNT(*) as c FROM requirements WHERE capability_id IS NOT NULL").get() as any;
    expect(reqs.c).toBeGreaterThanOrEqual(1);
  });

  it('tasks have requirement_refs in DNA', () => {
    const tasks = db.prepare("SELECT dna FROM tasks WHERE dna LIKE '%requirement_refs%'").all();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });
});
