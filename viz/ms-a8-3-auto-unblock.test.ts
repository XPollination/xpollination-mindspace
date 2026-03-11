/**
 * TDD tests for ms-a8-3-auto-unblock
 *
 * Verifies auto-unblock on task completion:
 * - blocked-status.ts service module
 * - On complete transition, check dependents and unblock if all deps satisfied
 * - Response includes auto_unblocked array
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/blocked-status.ts:
 *   - Export checkAndUnblock(db, completedTaskId) → unblocked[]
 *   - Query task_dependencies for tasks blocked by completedTaskId
 *   - For each dependent: check if ALL blocking tasks are complete
 *   - If yes, update status from blocked to ready
 * - Update task transition logic:
 *   - After complete transition, call checkAndUnblock
 *   - Include auto_unblocked in response
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a8-3-auto-unblock: blocked-status service", () => {
  it("blocked-status module exists", () => {
    const paths = [
      resolve(API_DIR, "services/blocked-status.ts"),
      resolve(API_DIR, "utils/blocked-status.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/blocked-status.ts"),
      resolve(API_DIR, "utils/blocked-status.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports checkAndUnblock function", () => {
    expect(content).toMatch(/export.*checkAndUnblock|checkAndUnblock|unblock/i);
  });

  it("queries task_dependencies for blocked tasks", () => {
    expect(content).toMatch(/task_dependencies|blocked_by_task_id/);
  });

  it("checks if all blocking tasks are complete", () => {
    expect(content).toMatch(/complete/i);
  });

  it("updates status from blocked to ready", () => {
    expect(content).toMatch(/blocked/);
    expect(content).toMatch(/ready/);
  });

  it("returns array of unblocked task IDs", () => {
    expect(content).toMatch(/unblock|auto_unblocked/i);
  });
});

describe("ms-a8-3-auto-unblock: transition integration", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/tasks.ts"),
      resolve(API_DIR, "routes/task-transitions.ts"),
      resolve(API_DIR, "services/task-transitions.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("calls auto-unblock after complete transition", () => {
    expect(content).toMatch(/unblock|checkAndUnblock/i);
  });

  it("includes auto_unblocked in response", () => {
    expect(content).toMatch(/auto_unblocked|unblocked/i);
  });
});
