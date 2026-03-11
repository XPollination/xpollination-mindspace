/**
 * TDD tests for ms-a12-7-mcp-set-focus
 *
 * Verifies mindspace_set_focus MCP tool:
 * - Tool file exists with correct name and schema
 * - Registered in tool index
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/setFocus.ts:
 *   - Tool name: 'mindspace_set_focus'
 *   - Input: project_slug (required), scope (required), task_ids (optional array)
 *   - Makes PUT request to focus endpoint
 *   - Returns updated focus
 * - Update src/tools/index.ts: register setFocus tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

describe("ms-a12-7-mcp-set-focus: tool file", () => {
  it("setFocus.ts exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "src/tools/mindspace/setFocus.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/mindspace/setFocus.ts"), "utf-8");
  } catch { content = ""; }

  it("tool name is mindspace_set_focus", () => {
    expect(content).toMatch(/mindspace_set_focus/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("requires scope input", () => {
    expect(content).toMatch(/scope/);
  });

  it("supports task_ids input", () => {
    expect(content).toMatch(/task_ids/);
  });

  it("makes PUT request to focus endpoint", () => {
    expect(content).toMatch(/PUT|put/);
    expect(content).toMatch(/focus/);
  });
});

describe("ms-a12-7-mcp-set-focus: registration", () => {
  let indexContent: string;
  try {
    indexContent = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { indexContent = ""; }

  it("registered in tools index", () => {
    expect(indexContent).toMatch(/setFocus|set_focus|mindspace_set_focus/i);
  });
});
