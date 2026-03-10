/**
 * TDD tests for ms-a12-1-mcp-list-projects
 *
 * Verifies mindspace_list_projects MCP tool:
 * - src/tools/mindspace/listProjects.ts: tool definition + handler
 * - src/tools/index.ts: tool registered in registry
 * - Uses fetch to call REST API GET /api/projects with X-API-Key
 * - MINDSPACE_API_URL env var (default localhost:3100)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/listProjects.ts:
 *   - Export tool definition (name: mindspace_list_projects)
 *   - Zod schema for input validation (optional filters)
 *   - Handler: fetch GET ${MINDSPACE_API_URL}/api/projects with X-API-Key header
 *   - MINDSPACE_API_URL defaults to http://localhost:3100
 *   - MINDSPACE_API_KEY from environment for auth
 *   - Return project list as MCP tool result
 * - Update src/tools/index.ts:
 *   - Import and register mindspace_list_projects tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"
);

// --- File structure ---
describe("ms-a12-1-mcp-list-projects: file structure", () => {
  it("src/tools/mindspace/listProjects.ts exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/listProjects.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/list-projects.ts"),
    ];
    expect(paths.some((p) => existsSync(p))).toBe(true);
  });
});

// --- Tool definition ---
describe("ms-a12-1-mcp-list-projects: listProjects tool", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/listProjects.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/list-projects.ts"),
    ];
    content = "";
    for (const p of paths) {
      try {
        content = readFileSync(p, "utf-8");
        if (content) break;
      } catch {}
    }
  } catch {
    content = "";
  }

  it("defines mindspace_list_projects tool name", () => {
    expect(content).toMatch(/mindspace_list_projects/);
  });

  it("uses fetch for HTTP requests", () => {
    expect(content).toMatch(/fetch/);
  });

  it("calls GET /api/projects endpoint", () => {
    expect(content).toMatch(/\/api\/projects/);
  });

  it("sends X-API-Key header", () => {
    expect(content).toMatch(/X-API-Key|x-api-key/i);
  });

  it("reads MINDSPACE_API_URL from environment", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });

  it("defaults API URL to localhost:3100", () => {
    expect(content).toMatch(/localhost:3100|127\.0\.0\.1:3100/);
  });

  it("reads MINDSPACE_API_KEY from environment", () => {
    expect(content).toMatch(/MINDSPACE_API_KEY|API_KEY/);
  });

  it("has description for the tool", () => {
    expect(content).toMatch(/description/i);
  });

  it("has inputSchema or Zod schema", () => {
    expect(content).toMatch(/inputSchema|schema|[Zz]od|z\./);
  });
});

// --- Tool registry ---
describe("ms-a12-1-mcp-list-projects: tools/index.ts registry", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports listProjects or mindspace tool", () => {
    expect(content).toMatch(/listProjects|list-projects|mindspace/i);
  });

  it("registers mindspace_list_projects in tool array", () => {
    expect(content).toMatch(/mindspace_list_projects|listProjects|mindspace/i);
  });
});
