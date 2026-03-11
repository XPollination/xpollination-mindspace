/**
 * TDD tests for ms-a16-1-bug-reports
 *
 * Verifies bug reports table and submission/list endpoints:
 * - Migration: bug_reports table with severity/status CHECK constraints
 * - POST /api/projects/:slug/bugs — submit (viewer+)
 * - GET /api/projects/:slug/bugs — list with filters (viewer+)
 * - GET /api/projects/:slug/bugs/:bugId — get single (viewer+)
 * - PUT /api/projects/:slug/bugs/:bugId — update (contributor+)
 * - No DELETE — use status:closed for audit trail
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/021-bug-reports.sql:
 *   - CREATE TABLE bug_reports (id, project_slug FK, title NOT NULL, description,
 *     severity CHECK (low/medium/high/critical), status CHECK (open/investigating/resolved/closed),
 *     task_id FK optional, reported_by FK users, created_at, updated_at)
 *   - Indexes: project_slug, (project_slug,status), (project_slug,severity)
 * - Create api/routes/bug-reports.ts:
 *   - Export bugReportsRouter with mergeParams
 *   - POST / (viewer+): submit bug, 201
 *   - GET / (viewer+): list bugs, ?status, ?severity filters, ordered by created_at DESC
 *   - GET /:bugId (viewer+): single bug
 *   - PUT /:bugId (contributor+): update metadata/status
 *   - No DELETE
 * - Update api/routes/projects.ts: mount at /:slug/bugs
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a16-1-bug-reports: migration", () => {
  it("bug-reports migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/021-bug-reports.sql"),
      resolve(API_DIR, "db/migrations/022-bug-reports.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/021-bug-reports.sql"),
      resolve(API_DIR, "db/migrations/022-bug-reports.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates bug_reports table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*bug_reports/i);
  });

  it("has project_slug FK to projects", () => {
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/REFERENCES\s+projects/i);
  });

  it("has title NOT NULL", () => {
    expect(content).toMatch(/title\s+TEXT\s+NOT\s+NULL/i);
  });

  it("has severity CHECK (low, medium, high, critical)", () => {
    expect(content).toMatch(/severity/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/low/);
    expect(content).toMatch(/medium/);
    expect(content).toMatch(/high/);
    expect(content).toMatch(/critical/);
  });

  it("has status CHECK (open, investigating, resolved, closed)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/open/);
    expect(content).toMatch(/investigating/);
    expect(content).toMatch(/resolved/);
    expect(content).toMatch(/closed/);
  });

  it("has task_id optional FK to tasks", () => {
    expect(content).toMatch(/task_id/);
  });

  it("has reported_by FK to users", () => {
    expect(content).toMatch(/reported_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has indexes on project_slug and status", () => {
    expect(content).toMatch(/CREATE\s+INDEX/i);
  });
});

// --- Router ---
describe("ms-a16-1-bug-reports: bug-reports.ts", () => {
  it("api/routes/bug-reports.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/bug-reports.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/bug-reports.ts"), "utf-8");
  } catch { content = ""; }

  it("exports bugReportsRouter", () => {
    expect(content).toMatch(/export.*bugReportsRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has POST handler to submit bugs (201)", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/201/);
  });

  it("has GET handler for listing bugs", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?status filter", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/query/i);
  });

  it("supports ?severity filter", () => {
    expect(content).toMatch(/severity/);
  });

  it("orders list by created_at DESC", () => {
    expect(content).toMatch(/DESC|ORDER\s+BY/i);
  });

  it("has PUT handler for updating bugs", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("returns 400 for invalid severity", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 404 for non-existent bug", () => {
    expect(content).toMatch(/404/);
  });

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });
});

// --- Mount ---
describe("ms-a16-1-bug-reports: projects.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports bugReportsRouter", () => {
    expect(content).toMatch(/bugReportsRouter|bug-reports/);
  });

  it("mounts at /:slug/bugs", () => {
    expect(content).toMatch(/bugs/);
  });
});
