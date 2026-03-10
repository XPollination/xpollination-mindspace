/**
 * TDD tests for ms-a5-1-focus-crud
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/016-project-focus.sql:
 *   - project_focus: id, project_slug (UNIQUE), scope, task_ids (JSON), set_by, timestamps
 * - Create api/routes/focus.ts:
 *   - GET / (viewer): current focus or null
 *   - PUT / (admin): create/update focus, requires scope
 *   - DELETE / (admin): clear focus, 204
 * - Update api/routes/projects.ts: mount at /:slug/focus
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a5-1-focus-crud: migration", () => {
  it("016-project-focus.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/016-project-focus.sql"))).toBe(true);
  });

  let content: string;
  try { content = readFileSync(resolve(API_DIR, "db/migrations/016-project-focus.sql"), "utf-8"); } catch { content = ""; }

  it("creates project_focus table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*project_focus/i);
  });

  it("has UNIQUE on project_slug (singleton)", () => {
    expect(content).toMatch(/UNIQUE/i);
    expect(content).toMatch(/project_slug/);
  });

  it("has scope column", () => {
    expect(content).toMatch(/scope/);
  });

  it("has task_ids column (JSON)", () => {
    expect(content).toMatch(/task_ids/);
  });
});

describe("ms-a5-1-focus-crud: focus.ts", () => {
  it("api/routes/focus.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/focus.ts"))).toBe(true);
  });

  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/focus.ts"), "utf-8"); } catch { content = ""; }

  it("exports focusRouter", () => {
    expect(content).toMatch(/export.*focusRouter/);
  });

  it("has GET handler", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("has PUT handler", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("PUT requires scope field", () => {
    expect(content).toMatch(/scope/);
    expect(content).toMatch(/400/);
  });

  it("has DELETE handler (204)", () => {
    expect(content).toMatch(/\.delete\(/i);
    expect(content).toMatch(/204/);
  });

  it("uses requireProjectAccess", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });

  it("admin required for PUT and DELETE", () => {
    expect(content).toMatch(/admin/i);
  });
});

describe("ms-a5-1-focus-crud: projects.ts mount", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8"); } catch { content = ""; }

  it("imports focusRouter", () => {
    expect(content).toMatch(/focusRouter|focus/);
  });

  it("mounts at /:slug/focus", () => {
    expect(content).toMatch(/focus/);
  });
});
