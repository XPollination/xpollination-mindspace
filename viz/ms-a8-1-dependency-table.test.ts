/**
 * TDD tests for ms-a8-1-dependency-table
 *
 * Verifies task dependency table and endpoints:
 * - Migration: task_dependencies directed edge table (task_id depends on blocked_by_task_id)
 * - GET /:taskId/dependencies (forward — what this task depends on)
 * - GET /:taskId/dependents (reverse — what depends on this task)
 * - POST /:taskId/dependencies (add dependency edge)
 * - DELETE /:taskId/dependencies/:depId (remove dependency edge)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/014-task-dependencies.sql:
 *   - CREATE TABLE task_dependencies (id, task_id FK, blocked_by_task_id FK, created_at, created_by FK)
 *   - UNIQUE(task_id, blocked_by_task_id)
 *   - Indexes on task_id and blocked_by_task_id
 * - Create api/routes/task-dependencies.ts:
 *   - Export taskDependenciesRouter with mergeParams
 *   - GET /dependencies, GET /dependents, POST /dependencies, DELETE /dependencies/:depId
 * - Update api/routes/tasks.ts: mount taskDependenciesRouter
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a8-1-dependency-table: migration", () => {
  it("task-dependencies migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/014-task-dependencies.sql"),
      resolve(API_DIR, "db/migrations/015-task-dependencies.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/014-task-dependencies.sql"),
      resolve(API_DIR, "db/migrations/015-task-dependencies.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates task_dependencies table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*task_dependencies/i);
  });

  it("has task_id column", () => {
    expect(content).toMatch(/task_id/);
  });

  it("has blocked_by_task_id column", () => {
    expect(content).toMatch(/blocked_by_task_id|blocked_by/);
  });

  it("has UNIQUE constraint on (task_id, blocked_by_task_id)", () => {
    expect(content).toMatch(/UNIQUE/i);
  });

  it("has FK references to tasks", () => {
    expect(content).toMatch(/REFERENCES\s+tasks/i);
  });

  it("has indexes", () => {
    expect(content).toMatch(/CREATE\s+INDEX/i);
  });
});

// --- Router ---
describe("ms-a8-1-dependency-table: task-dependencies.ts", () => {
  it("api/routes/task-dependencies.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/task-dependencies.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-dependencies.ts"), "utf-8");
  } catch { content = ""; }

  it("exports taskDependenciesRouter", () => {
    expect(content).toMatch(/export.*taskDependenciesRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has GET handler for dependencies (forward)", () => {
    expect(content).toMatch(/dependencies/);
    expect(content).toMatch(/\.get\(/i);
  });

  it("has GET handler for dependents (reverse)", () => {
    expect(content).toMatch(/dependents/);
  });

  it("has POST handler to add dependency", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has DELETE handler to remove dependency", () => {
    expect(content).toMatch(/\.delete\(/i);
  });

  it("returns 404 for non-existent task", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 400 for self-dependency", () => {
    expect(content).toMatch(/400/);
  });
});

// --- Mount ---
describe("ms-a8-1-dependency-table: tasks.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("imports taskDependenciesRouter", () => {
    expect(content).toMatch(/taskDependenciesRouter|task-dependencies/);
  });
});
