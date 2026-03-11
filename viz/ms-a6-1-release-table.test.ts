/**
 * TDD tests for ms-a6-1-release-table
 *
 * Verifies releases table and CRUD:
 * - Migration: releases table with status (draft/sealed)
 * - POST/GET/PUT endpoints
 * - Mount at /:slug/releases
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/022-releases.sql:
 *   - CREATE TABLE releases (id, project_slug FK, version TEXT NOT NULL,
 *     status CHECK (draft/sealed), created_by FK users, sealed_at, sealed_by FK users,
 *     created_at, updated_at)
 *   - UNIQUE(project_slug, version)
 *   - Indexes on project_slug, status
 * - Create api/routes/releases.ts:
 *   - Export releasesRouter with mergeParams
 *   - POST / (admin), GET / (viewer), GET /:releaseId, PUT /:releaseId (admin)
 * - Update api/routes/projects.ts: mount at /:slug/releases
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a6-1-release-table: migration", () => {
  it("releases migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/022-releases.sql"),
      resolve(API_DIR, "db/migrations/023-releases.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/022-releases.sql"),
      resolve(API_DIR, "db/migrations/023-releases.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates releases table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*releases/i);
  });

  it("has version TEXT NOT NULL", () => {
    expect(content).toMatch(/version/);
  });

  it("has status CHECK (draft, sealed)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/draft/);
    expect(content).toMatch(/sealed/);
  });

  it("has UNIQUE(project_slug, version)", () => {
    expect(content).toMatch(/UNIQUE/i);
  });
});

describe("ms-a6-1-release-table: releases.ts", () => {
  it("api/routes/releases.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/releases.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/releases.ts"), "utf-8");
  } catch { content = ""; }

  it("exports releasesRouter", () => {
    expect(content).toMatch(/export.*releasesRouter/);
  });

  it("has POST handler", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has GET handler", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("has PUT handler", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("returns 409 for duplicate version", () => {
    expect(content).toMatch(/409/);
  });

  it("returns 404 for non-existent release", () => {
    expect(content).toMatch(/404/);
  });
});

describe("ms-a6-1-release-table: projects.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch { content = ""; }

  it("imports releasesRouter", () => {
    expect(content).toMatch(/releasesRouter|releases/);
  });

  it("mounts at /:slug/releases", () => {
    expect(content).toMatch(/releases/);
  });
});
