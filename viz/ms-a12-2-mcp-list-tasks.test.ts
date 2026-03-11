/**
 * TDD tests for ms-a12-2-mcp-list-tasks
 *
 * Verifies mindspace_list_tasks MCP tool:
 * - Tool file with correct name and schema
 * - Filter support (status, role, available_only, blocked_only)
 * - Registered in tool index
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/listTasks.ts:
 *   - Tool name: 'mindspace_list_tasks'
 *   - Input: project_slug (required), status, current_role, available_only, blocked_only (optional)
 *   - Builds query string from filters
 *   - GETs from tasks endpoint
 *   - Returns task array
 * - Update src/tools/index.ts: register listTasks tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

describe("ms-a12-2-mcp-list-tasks: tool file", () => {
  it("listTasks.ts exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "src/tools/mindspace/listTasks.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/mindspace/listTasks.ts"), "utf-8");
  } catch { content = ""; }

  it("tool name is mindspace_list_tasks", () => {
    expect(content).toMatch(/mindspace_list_tasks/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("supports status filter", () => {
    expect(content).toMatch(/status/);
  });

  it("supports current_role filter", () => {
    expect(content).toMatch(/current_role|role/);
  });

  it("supports available_only filter", () => {
    expect(content).toMatch(/available_only/);
  });

  it("supports blocked_only filter", () => {
    expect(content).toMatch(/blocked_only/);
  });

  it("builds query string from filters", () => {
    expect(content).toMatch(/query|params|\?|URLSearchParams/i);
  });
});

describe("ms-a12-2-mcp-list-tasks: registration", () => {
  let indexContent: string;
  try {
    indexContent = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { indexContent = ""; }

  it("registered in tools index", () => {
    expect(indexContent).toMatch(/listTasks|list_tasks|mindspace_list/i);
  });
});
