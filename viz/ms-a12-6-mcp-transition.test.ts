/**
 * TDD tests for ms-a12-6-mcp-transition
 *
 * Verifies mindspace_transition_task MCP tool:
 * - Tool file with correct name and schema
 * - Handles approval gate (approval_request_id)
 * - Registered in tool index
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/transitionTask.ts:
 *   - Tool name: 'mindspace_transition_task'
 *   - Input: project_slug, task_id, to_status, actor (required), reason (optional)
 *   - POSTs to transition endpoint
 *   - Surfaces approval_request_id when human gate hit
 *   - Returns full transition result
 * - Update src/tools/index.ts: register transitionTask tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

describe("ms-a12-6-mcp-transition: tool file", () => {
  it("transitionTask.ts exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "src/tools/mindspace/transitionTask.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/mindspace/transitionTask.ts"), "utf-8");
  } catch { content = ""; }

  it("tool name is mindspace_transition_task", () => {
    expect(content).toMatch(/mindscape_transition_task|mindspace_transition_task/);
  });

  it("requires to_status input", () => {
    expect(content).toMatch(/to_status/);
  });

  it("requires actor input", () => {
    expect(content).toMatch(/actor/);
  });

  it("supports optional reason", () => {
    expect(content).toMatch(/reason/);
  });

  it("POSTs to transition endpoint", () => {
    expect(content).toMatch(/POST|post/);
    expect(content).toMatch(/transition/);
  });

  it("handles approval_request_id in response", () => {
    expect(content).toMatch(/approval_request_id|approval/i);
  });
});

describe("ms-a12-6-mcp-transition: registration", () => {
  let indexContent: string;
  try {
    indexContent = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { indexContent = ""; }

  it("registered in tools index", () => {
    expect(indexContent).toMatch(/transitionTask|transition_task|mindspace_transition/i);
  });
});
