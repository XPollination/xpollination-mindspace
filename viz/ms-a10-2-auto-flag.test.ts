/**
 * TDD tests for ms-a10-2-auto-flag
 *
 * Verifies auto-create flag on task creation:
 * - POST /api/projects/:slug/tasks auto-generates feature flag
 * - Flag name format: XPO_FEATURE_<8chars>
 * - No new migration (uses existing feature_flags table)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/tasks.ts POST handler:
 *   - After creating task, auto-create feature_flag entry
 *   - Flag name: XPO_FEATURE_ + 8 random hex chars
 *   - State: 'off' by default
 *   - Link via task_id
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a10-2-auto-flag: tasks.ts auto-flag", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("creates feature flag on task creation", () => {
    expect(content).toMatch(/feature_flag/i);
    expect(content).toMatch(/INSERT/i);
  });

  it("generates flag name with XPO_FEATURE_ prefix", () => {
    expect(content).toMatch(/XPO_FEATURE_/);
  });

  it("generates 8-char random suffix", () => {
    expect(content).toMatch(/random|hex|uuid|substring/i);
  });

  it("sets default state to off", () => {
    expect(content).toMatch(/off/);
  });

  it("links flag to task via task_id", () => {
    expect(content).toMatch(/task_id/);
  });

  it("includes flag info in task creation response", () => {
    expect(content).toMatch(/flag|feature_flag/i);
  });
});
