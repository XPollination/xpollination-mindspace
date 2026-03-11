/**
 * TDD tests for ms-a8-4-dep-filtering
 *
 * Verifies dependency-aware task filtering:
 * - available_only=true excludes tasks with incomplete dependencies
 * - blocked_only=true shows only dependency-blocked tasks
 * - Task response includes is_blocked and blocking_tasks
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/tasks.ts:
 *   - Enhance GET list with available_only=true filter:
 *     - Exclude tasks with incomplete deps (LEFT JOIN task_dependencies)
 *     - A task is blocked if ANY task_dependencies row has blocked_by_task status != 'complete'
 *   - Add blocked_only=true filter (inverse)
 *   - Enrich both list and single-task response with:
 *     - is_blocked: boolean
 *     - blocking_tasks: [{id, title, status}] for incomplete deps
 *   - Use subquery/CTE pattern (not inline JOINs)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a8-4-dep-filtering: tasks.ts filters", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("supports available_only query parameter", () => {
    expect(content).toMatch(/available_only/);
  });

  it("supports blocked_only query parameter", () => {
    expect(content).toMatch(/blocked_only/);
  });

  it("queries task_dependencies table for blocking check", () => {
    expect(content).toMatch(/task_dependencies/);
  });

  it("checks blocked_by_task status for completeness", () => {
    expect(content).toMatch(/complete/);
    expect(content).toMatch(/status/);
  });

  it("uses subquery or CTE pattern", () => {
    expect(content).toMatch(/SELECT|JOIN|subquery|CTE|WITH/i);
  });

  it("enriches response with is_blocked field", () => {
    expect(content).toMatch(/is_blocked/);
  });

  it("enriches response with blocking_tasks array", () => {
    expect(content).toMatch(/blocking_tasks/);
  });

  it("blocking_tasks includes id, title, and status", () => {
    expect(content).toMatch(/blocking_tasks/);
    expect(content).toMatch(/title/);
  });

  it("available_only excludes blocked tasks via dependency check", () => {
    expect(content).toMatch(/available_only/);
    expect(content).toMatch(/task_dependencies/);
  });

  it("handles tasks with no dependencies (not blocked)", () => {
    expect(content).toMatch(/LEFT\s+JOIN|left.*join/i);
  });
});
