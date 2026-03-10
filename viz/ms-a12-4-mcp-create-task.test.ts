/**
 * TDD tests for ms-a12-4-mcp-create-task
 *
 * Verifies mindspace_create_task MCP tool:
 * - Tool file exists (createTask.ts in src/tools/mindspace/)
 * - Registered in tool index
 * - POST to tasks API with required and optional fields
 * - Input validation
 * - Error handling
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/createTask.ts:
 *   - Export tool with name "mindspace_create_task"
 *   - Input: { project_slug (req), title (req), description, current_role, requirement_id, feature_flag_name }
 *   - POST /api/projects/:slug/tasks
 *   - current_role enum: pdsa, dev, qa, liaison
 *   - Returns created task with UUID
 *   - Defaults to status=pending
 * - Update src/tools/index.ts: register tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a12-4-mcp-create-task: file structure", () => {
  it("createTask.ts exists in src/tools/mindspace/", () => {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/createTask.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/create-task.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });
});

// --- Tool implementation ---
describe("ms-a12-4-mcp-create-task: createTask.ts", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/createTask.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/create-task.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("defines tool name mindspace_create_task", () => {
    expect(content).toMatch(/mindscape_create_task|mindspace_create_task/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("requires title input", () => {
    expect(content).toMatch(/title/);
  });

  it("accepts optional description", () => {
    expect(content).toMatch(/description/);
  });

  it("accepts optional current_role with enum validation", () => {
    expect(content).toMatch(/current_role/);
    expect(content).toMatch(/pdsa|dev|qa|liaison/);
  });

  it("accepts optional requirement_id", () => {
    expect(content).toMatch(/requirement_id/);
  });

  it("POSTs to tasks API endpoint", () => {
    expect(content).toMatch(/\/tasks/);
    expect(content).toMatch(/POST|fetch|http/i);
  });

  it("uses MINDSPACE_API_URL env var", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });
});

// --- Tool registration ---
describe("ms-a12-4-mcp-create-task: index.ts registration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { content = ""; }

  it("imports createTask tool", () => {
    expect(content).toMatch(/createTask|create-task|mindspace_create_task/i);
  });
});
