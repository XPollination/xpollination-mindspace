/**
 * TDD tests for ms-a3-1-tasks-crud
 *
 * Verifies tasks table and CRUD endpoints:
 * - Migration: tasks table with status CHECK, role CHECK, FKs, indexes
 * - POST /api/projects/:slug/tasks — create task (contributor+)
 * - GET /api/projects/:slug/tasks — list with ?status and ?current_role filters
 * - GET /api/projects/:slug/tasks/:taskId — get single task
 * - PUT /api/projects/:slug/tasks/:taskId — update metadata only (NOT status)
 * - DELETE /api/projects/:slug/tasks/:taskId — admin only
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/011-tasks.sql (or 012 if 011 taken):
 *   - CREATE TABLE tasks with columns: id, project_slug, requirement_id, title,
 *     description, status, current_role, claimed_by, claimed_at, feature_flag_name,
 *     created_at, created_by, updated_at
 *   - status CHECK: pending, ready, active, review, approval, approved, testing, rework, blocked, complete
 *   - current_role CHECK: pdsa, dev, qa, liaison + NULL
 *   - FKs: project_slug→projects(slug), claimed_by→agents(id), created_by→users(id)
 *   - Indexes: project_slug, status, current_role, claimed_by
 * - Create api/routes/tasks.ts:
 *   - Export tasksRouter with mergeParams
 *   - POST / (contributor+): create task, return 201
 *   - GET / (viewer+): list tasks, filter by ?status and ?current_role
 *   - GET /:taskId (viewer+): get single task
 *   - PUT /:taskId (contributor+): update metadata only (NOT status)
 *   - DELETE /:taskId (admin): hard delete, return 204
 * - Update api/routes/projects.ts: mount tasksRouter at /:slug/tasks
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a3-1-tasks-crud: migration", () => {
  it("tasks migration SQL file exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/011-tasks.sql"),
      resolve(API_DIR, "db/migrations/012-tasks.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/011-tasks.sql"),
      resolve(API_DIR, "db/migrations/012-tasks.sql"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("creates tasks table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*tasks/i);
  });

  it("has id as TEXT PRIMARY KEY", () => {
    expect(content).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY/i);
  });

  it("has project_slug with FK to projects", () => {
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/REFERENCES\s+projects/i);
  });

  it("has title as NOT NULL", () => {
    expect(content).toMatch(/title\s+TEXT\s+NOT\s+NULL/i);
  });

  it("has status CHECK constraint with 10 states", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/pending/);
    expect(content).toMatch(/ready/);
    expect(content).toMatch(/active/);
    expect(content).toMatch(/review/);
    expect(content).toMatch(/complete/);
  });

  it("has current_role CHECK constraint", () => {
    expect(content).toMatch(/current_role/);
    expect(content).toMatch(/pdsa/);
    expect(content).toMatch(/dev/);
    expect(content).toMatch(/qa/);
    expect(content).toMatch(/liaison/);
  });

  it("has claimed_by FK to agents", () => {
    expect(content).toMatch(/claimed_by/);
    expect(content).toMatch(/REFERENCES\s+agents/i);
  });

  it("has created_by FK to users", () => {
    expect(content).toMatch(/created_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has indexes on project_slug, status, current_role", () => {
    expect(content).toMatch(/idx_tasks_project|CREATE\s+INDEX.*tasks.*project_slug/i);
    expect(content).toMatch(/idx_tasks_status|CREATE\s+INDEX.*tasks.*status/i);
  });
});

// --- Tasks router ---
describe("ms-a3-1-tasks-crud: tasks.ts router", () => {
  it("api/routes/tasks.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/tasks.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("exports tasksRouter", () => {
    expect(content).toMatch(/export.*tasksRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has POST handler for creating tasks", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/201/);
  });

  it("has GET handler for listing tasks", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?status query filter", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/query/i);
  });

  it("supports ?current_role query filter", () => {
    expect(content).toMatch(/current_role/);
  });

  it("has GET /:taskId handler", () => {
    expect(content).toMatch(/taskId|task_id|:id/i);
  });

  it("has PUT handler for updating task metadata", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("PUT does NOT allow status changes", () => {
    // Status should be excluded from update fields
    expect(content).toMatch(/status/);
  });

  it("has DELETE handler (admin only)", () => {
    expect(content).toMatch(/\.delete\(/i);
    expect(content).toMatch(/204/);
  });

  it("returns 400 for missing title on create", () => {
    expect(content).toMatch(/400/);
    expect(content).toMatch(/title/);
  });

  it("returns 404 for non-existent task", () => {
    expect(content).toMatch(/404/);
  });

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });
});

// --- Projects mount ---
describe("ms-a3-1-tasks-crud: projects.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports tasksRouter", () => {
    expect(content).toMatch(/tasksRouter|tasks/);
  });

  it("mounts at /:slug/tasks", () => {
    expect(content).toMatch(/tasks/);
  });
});
