/**
 * TDD tests for ms-a16-1-bug-reports
 *
 * Verifies bug reports table and submission endpoint:
 * - Migration: bug_reports table with severity CHECK, status CHECK
 * - Per-project at /api/projects/:slug/bugs
 * - POST (viewer submits), GET (viewer lists), GET /:bugId, PUT (contributor updates)
 * - No DELETE — bugs are closed, not deleted
 * - Severity enum: low, medium, high, critical
 * - Status enum: open, investigating, resolved, closed
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/021-bug-reports.sql:
 *   - CREATE TABLE bug_reports (id, project_slug FK, title, description,
 *     severity CHECK, status CHECK, task_id FK optional, reported_by FK users,
 *     created_at, updated_at)
 *   - Indexes on project_slug, (project_slug, status), (project_slug, severity)
 * - Create api/routes/bug-reports.ts:
 *   - Export bugReportsRouter with mergeParams
 *   - POST / (viewer), GET / (viewer, ?status, ?severity filter), GET /:bugId (viewer)
 *   - PUT /:bugId (contributor)
 *   - No DELETE — use status:closed
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
    expect(content).toMatch(/REFERENCES\s+tasks/i);
  });

  it("has reported_by FK to users", () => {
    expect(content).toMatch(/reported_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has indexes on project_slug and status and severity", () => {
    expect(content).toMatch(/INDEX.*bug_reports.*project/i);
    expect(content).toMatch(/INDEX.*bug_reports.*status/i);
    expect(content).toMatch(/INDEX.*bug_reports.*severity/i);
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

  it("has POST handler for submitting bugs", () => {
    expect(content).toMatch(/\.post\(/i);
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

  it("has PUT handler for updating bugs", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("does NOT have DELETE handler (use closed status)", () => {
    expect(content).not.toMatch(/\.delete\(/i);
  });

  it("viewer can submit (requireProjectAccess viewer)", () => {
    expect(content).toMatch(/requireProjectAccess/);
    expect(content).toMatch(/viewer/);
  });

  it("contributor required for updates", () => {
    expect(content).toMatch(/contributor/);
  });

  it("returns 400 for missing title", () => {
    expect(content).toMatch(/400/);
    expect(content).toMatch(/title/);
  });

  it("returns 400 for invalid severity", () => {
    expect(content).toMatch(/400/);
    expect(content).toMatch(/severity/);
  });

  it("returns 404 for non-existent bug", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 201 on successful creation", () => {
    expect(content).toMatch(/201/);
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
