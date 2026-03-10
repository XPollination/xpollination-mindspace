/**
 * TDD tests for ms-a12-8-mcp-project-status
 *
 * Verifies mindspace_get_project_status MCP tool:
 * - Calls REST API for project overview (project details + members)
 * - Progressive enhancement: degrades gracefully for missing endpoints
 * - Reuses HTTP client pattern from ms-a12-1
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/getProjectStatus.ts:
 *   - Export tool definition (name: mindspace_get_project_status)
 *   - Required input: project_slug
 *   - Calls GET /api/projects/:slug for project details
 *   - Calls GET /api/projects/:slug/members for member list
 *   - Graceful degradation for missing endpoints (tasks, agents, etc.)
 *   - apiGet() helper function for DRY HTTP calls
 *   - Uses MINDSPACE_API_URL + MINDSPACE_API_KEY env vars
 * - Update src/tools/index.ts: register tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);

// --- File structure ---
describe("ms-a12-8-mcp-project-status: file structure", () => {
  it("getProjectStatus tool file exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/getProjectStatus.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/get-project-status.ts"),
    ];
    expect(paths.some((p) => existsSync(p))).toBe(true);
  });
});

// --- Tool definition ---
describe("ms-a12-8-mcp-project-status: getProjectStatus tool", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/getProjectStatus.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/get-project-status.ts"),
    ];
    content = "";
    for (const p of paths) {
      try { content = readFileSync(p, "utf-8"); if (content) break; } catch {}
    }
  } catch { content = ""; }

  it("defines mindspace_get_project_status tool name", () => {
    expect(content).toMatch(/mindspace_get_project_status/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug|projectSlug/);
  });

  it("calls GET /api/projects/:slug", () => {
    expect(content).toMatch(/\/api\/projects/);
  });

  it("calls members endpoint", () => {
    expect(content).toMatch(/members/);
  });

  it("uses fetch for HTTP requests", () => {
    expect(content).toMatch(/fetch/);
  });

  it("has apiGet or similar helper function", () => {
    expect(content).toMatch(/apiGet|fetchApi|getApi|helper/i);
  });

  it("handles graceful degradation for missing endpoints", () => {
    expect(content).toMatch(/catch|graceful|degrade|fallback|null|undefined/i);
  });

  it("reads MINDSPACE_API_URL", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });

  it("has description", () => {
    expect(content).toMatch(/description/i);
  });
});

// --- Registry ---
describe("ms-a12-8-mcp-project-status: tools/index.ts registry", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { content = ""; }

  it("imports getProjectStatus tool", () => {
    expect(content).toMatch(/getProjectStatus|get-project-status|project.?status/i);
  });

  it("registers mindspace_get_project_status", () => {
    expect(content).toMatch(/mindspace_get_project_status|getProjectStatus|project.?status/i);
  });
});
