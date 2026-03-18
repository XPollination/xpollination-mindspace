import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, teardownTestDb } from '../test-helpers/setup.js';
import type { Express } from 'express';
import type Database from 'better-sqlite3';

/**
 * Viz Hierarchy Drill-Down Tests — graph-viz-hierarchy-drilldown
 * Validates: API endpoints return populated hierarchy data for viz drill-down.
 * TDD: Dev ensures API routes serve missions, capabilities with requirements,
 *       and task detail with breadcrumb after migrations 046-049.
 */

let app: Express;
let db: Database.Database;
let authToken: string;
const USER_ID = 'viz-test-user';

beforeAll(async () => {
  const result = await createTestApp();
  app = result.app;
  db = result.db;

  // Create test user and project access
  db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)").run(USER_ID, 'viz@test.com', '$2b$10$x', 'Viz User');
  authToken = jwt.sign({ sub: USER_ID, email: 'viz@test.com' }, process.env.JWT_SECRET!);
  db.prepare("INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES ('p-viz', 'xpollination-mcp-server', 'XPollination', 'Test', ?)").run(USER_ID);
  db.prepare("INSERT OR IGNORE INTO project_access (user_id, project_slug, role, granted_by) VALUES (?, 'xpollination-mcp-server', 'admin', ?)").run(USER_ID, USER_ID);
});

afterAll(() => { teardownTestDb(); });

describe('Mission Overview API', () => {

  it('GET /api/v1/projects/xpollination-mcp-server/missions returns 3+ missions', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/missions')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const missions = res.body.missions || res.body;
    expect(Array.isArray(missions)).toBe(true);
    expect(missions.length).toBeGreaterThanOrEqual(3);
  });

  it('missions include Fair Attribution, Traversable Context, Agent-Human Collaboration', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/missions')
      .set('Authorization', `Bearer ${authToken}`);
    const missions = res.body.missions || res.body;
    const titles = missions.map((m: any) => m.title);
    expect(titles.some((t: string) => /Fair Attribution/i.test(t))).toBe(true);
    expect(titles.some((t: string) => /Traversable Context/i.test(t))).toBe(true);
    expect(titles.some((t: string) => /Agent.Human/i.test(t))).toBe(true);
  });

  it('each mission includes capability count', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/missions')
      .set('Authorization', `Bearer ${authToken}`);
    const missions = res.body.missions || res.body;
    for (const m of missions) {
      expect(m.capability_count !== undefined || m.capabilities !== undefined).toBe(true);
    }
  });
});

describe('Capability Detail API with Requirements', () => {

  it('GET /api/v1/projects/xpollination-mcp-server/capabilities/cap-auth returns capability with requirements', async () => {
    const res = await request(app)
      .get('/api/v1/projects/xpollination-mcp-server/capabilities/cap-auth')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const cap = res.body;
    expect(cap.id || cap.capability?.id).toBe('cap-auth');
    // Should include requirements
    const reqs = cap.requirements || cap.requirement_list;
    expect(reqs).toBeDefined();
    expect(reqs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Breadcrumb hierarchy data', () => {

  it('mission has id, title, slug fields for breadcrumb rendering', () => {
    const missions = db.prepare("SELECT id, title, slug FROM missions WHERE id LIKE 'mission-%'").all() as any[];
    expect(missions.length).toBeGreaterThanOrEqual(3);
    for (const m of missions) {
      expect(m.id).toBeTruthy();
      expect(m.title).toBeTruthy();
    }
  });

  it('capabilities have mission_id for upward traversal', () => {
    const caps = db.prepare("SELECT id, mission_id FROM capabilities WHERE mission_id LIKE 'mission-%'").all() as any[];
    expect(caps.length).toBeGreaterThanOrEqual(9);
    for (const c of caps) {
      expect(c.mission_id).toBeTruthy();
    }
  });

  it('requirements have capability_id for upward traversal', () => {
    const reqs = db.prepare("SELECT id, capability_id FROM requirements WHERE capability_id IS NOT NULL").all() as any[];
    expect(reqs.length).toBeGreaterThanOrEqual(15);
    for (const r of reqs) {
      expect(r.capability_id).toBeTruthy();
    }
  });
});

describe('Full traversal chain exists in DB', () => {

  it('Mission → Capability → Requirement chain is complete for all 3 missions', () => {
    const chain = db.prepare(`
      SELECT m.id as mission_id, m.title as mission_title,
             c.id as cap_id, r.id as req_id
      FROM missions m
      JOIN capabilities c ON c.mission_id = m.id
      JOIN requirements r ON r.capability_id = c.id
      WHERE m.id IN ('mission-fair-attribution', 'mission-traversable-context', 'mission-agent-human-collab')
    `).all() as any[];
    expect(chain.length).toBeGreaterThanOrEqual(15);

    // Each mission should have at least one complete chain
    const missionIds = [...new Set(chain.map((r: any) => r.mission_id))];
    expect(missionIds.length).toBe(3);
  });
});
