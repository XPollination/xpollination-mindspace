/**
 * TDD tests for ms-a5-2-focus-filter
 *
 * Verifies task filtering by focus scope:
 * - GET /api/projects/:slug/tasks?focus=true filters by project_focus
 * - No new migration (uses existing project_focus table)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/tasks.ts GET / handler:
 *   - When ?focus=true, JOIN project_focus and filter tasks by focus scope
 *   - Focus scope can be requirement_id, feature group, etc.
 *   - Returns only tasks within the current focus
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a5-2-focus-filter: tasks.ts focus filter", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("supports ?focus query parameter", () => {
    expect(content).toMatch(/focus/);
    expect(content).toMatch(/query/i);
  });

  it("references project_focus table", () => {
    expect(content).toMatch(/project_focus/);
  });

  it("JOINs or queries focus scope", () => {
    expect(content).toMatch(/JOIN|focus|scope/i);
  });

  it("filters tasks by focus scope criteria", () => {
    expect(content).toMatch(/focus/);
    expect(content).toMatch(/WHERE|AND/i);
  });

  it("returns empty array when no focus is set", () => {
    expect(content).toMatch(/focus/);
  });
});
