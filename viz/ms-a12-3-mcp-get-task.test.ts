/**
 * TDD tests for ms-a12-3-mcp-get-task
 *
 * Verifies mindspace_get_task MCP tool:
 * - Tool file exists (getTask.ts in src/tools/mindspace/)
 * - Registered in tool index
 * - Fetches task from API, enriches with requirement
 * - Graceful degradation for unavailable endpoints
 * - Input validation (project_slug, task_id required)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/getTask.ts:
 *   - Export tool definition with name "mindspace_get_task"
 *   - Input: { project_slug, task_id }
 *   - GET /api/projects/:slug/tasks/:taskId
 *   - Enrich with requirement (GET /api/projects/:slug/requirements/:reqId) if requirement_id present
 *   - Graceful degradation for dependencies/transitions endpoints (catch 404)
 *   - Uses MINDSPACE_API_URL env var
 * - Update src/tools/index.ts: register tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a12-3-mcp-get-task: file structure", () => {
  it("getTask.ts exists in src/tools/mindspace/", () => {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/getTask.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/get-task.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });
});

// --- Tool implementation ---
describe("ms-a12-3-mcp-get-task: getTask.ts", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/getTask.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/get-task.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("defines tool name mindspace_get_task", () => {
    expect(content).toMatch(/mindspace_get_task/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("requires task_id input", () => {
    expect(content).toMatch(/task_id/);
  });

  it("fetches from tasks API endpoint", () => {
    expect(content).toMatch(/\/tasks\//);
    expect(content).toMatch(/fetch|http|axios/i);
  });

  it("enriches with requirement data when requirement_id present", () => {
    expect(content).toMatch(/requirement/i);
  });

  it("handles graceful degradation for unavailable endpoints", () => {
    expect(content).toMatch(/catch|try|404|graceful/i);
  });

  it("uses MINDSPACE_API_URL env var", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });
});

// --- Tool registration ---
describe("ms-a12-3-mcp-get-task: index.ts registration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { content = ""; }

  it("imports getTask tool", () => {
    expect(content).toMatch(/getTask|get-task|mindspace_get_task/i);
  });
});
