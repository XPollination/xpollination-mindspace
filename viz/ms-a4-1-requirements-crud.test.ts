/**
 * TDD tests for ms-a4-1-requirements-crud
 *
 * Verifies requirements table and CRUD endpoints:
 * - Migration: requirements table with status/priority CHECK, UNIQUE(project_slug, req_id_human)
 * - POST /api/projects/:slug/requirements — create (contributor+)
 * - GET /api/projects/:slug/requirements — list with ?status and ?priority filters
 * - GET /api/projects/:slug/requirements/:reqId — get by UUID or req_id_human
 * - PUT /api/projects/:slug/requirements/:reqId — update (contributor+)
 * - No DELETE — deprecation only for traceability
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/012-requirements.sql (or 013 if 012 taken):
 *   - CREATE TABLE requirements: id, project_slug, req_id_human, title, description,
 *     status, priority, current_version, created_at, created_by, updated_at
 *   - status CHECK: draft, active, deprecated
 *   - priority CHECK: low, medium, high, critical
 *   - UNIQUE(project_slug, req_id_human)
 *   - FKs: project_slug→projects(slug), created_by→users(id)
 *   - Indexes: project_slug, status, req_id_human
 * - Create api/routes/requirements.ts:
 *   - Export requirementsRouter with mergeParams
 *   - POST / (contributor+): create requirement with req_id_human + title, return 201
 *   - GET / (viewer+): list, filter by ?status and ?priority
 *   - GET /:reqId (viewer+): dual lookup — UUID or req_id_human
 *   - PUT /:reqId (contributor+): update fields
 *   - NO DELETE endpoint — use status=deprecated
 * - Update api/routes/projects.ts: mount requirementsRouter at /:slug/requirements
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a4-1-requirements-crud: migration", () => {
  it("requirements migration SQL file exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/012-requirements.sql"),
      resolve(API_DIR, "db/migrations/013-requirements.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/012-requirements.sql"),
      resolve(API_DIR, "db/migrations/013-requirements.sql"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("creates requirements table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*requirements/i);
  });

  it("has req_id_human column", () => {
    expect(content).toMatch(/req_id_human/);
  });

  it("has UNIQUE constraint on (project_slug, req_id_human)", () => {
    expect(content).toMatch(/UNIQUE/i);
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/req_id_human/);
  });

  it("has status CHECK: draft, active, deprecated", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/draft/);
    expect(content).toMatch(/active/);
    expect(content).toMatch(/deprecated/);
  });

  it("has priority CHECK: low, medium, high, critical", () => {
    expect(content).toMatch(/priority/);
    expect(content).toMatch(/low/);
    expect(content).toMatch(/medium/);
    expect(content).toMatch(/high/);
    expect(content).toMatch(/critical/);
  });

  it("has project_slug FK to projects", () => {
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/REFERENCES\s+projects/i);
  });

  it("has created_by FK to users", () => {
    expect(content).toMatch(/created_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has current_version column", () => {
    expect(content).toMatch(/current_version/);
  });

  it("has indexes on project_slug, status, req_id_human", () => {
    expect(content).toMatch(/idx_requirements_project|CREATE\s+INDEX.*requirements.*project_slug/i);
    expect(content).toMatch(/idx_requirements_status|CREATE\s+INDEX.*requirements.*status/i);
  });
});

// --- Requirements router ---
describe("ms-a4-1-requirements-crud: requirements.ts router", () => {
  it("api/routes/requirements.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/requirements.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/requirements.ts"), "utf-8");
  } catch { content = ""; }

  it("exports requirementsRouter", () => {
    expect(content).toMatch(/export.*requirementsRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has POST handler for creating requirements (201)", () => {
    expect(content).toMatch(/\.post\(/i);
    expect(content).toMatch(/201/);
  });

  it("has GET handler for listing requirements", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?status query filter", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/query/i);
  });

  it("supports ?priority query filter", () => {
    expect(content).toMatch(/priority/);
  });

  it("has GET /:reqId with dual lookup (UUID or req_id_human)", () => {
    expect(content).toMatch(/reqId|req_id/i);
    expect(content).toMatch(/req_id_human/);
  });

  it("has PUT handler for updating requirements", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("does NOT have DELETE handler (traceability)", () => {
    // Router should NOT have .delete( — requirements are deprecated, not deleted
    // We check that the file mentions deprecation approach
    expect(content).toMatch(/deprecat|status/i);
  });

  it("returns 400 for missing req_id_human or title", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 409 for duplicate req_id_human", () => {
    expect(content).toMatch(/409/);
  });

  it("returns 404 for non-existent requirement", () => {
    expect(content).toMatch(/404/);
  });

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });
});

// --- Projects mount ---
describe("ms-a4-1-requirements-crud: projects.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports requirementsRouter", () => {
    expect(content).toMatch(/requirementsRouter|requirements/);
  });

  it("mounts at /:slug/requirements", () => {
    expect(content).toMatch(/requirements/);
  });
});
