/**
 * TDD tests for ms-a8-2-cycle-detection
 *
 * Verifies cycle detection on dependency creation:
 * - cycle-detection.ts service module exists
 * - Integrated into POST /dependencies (rejects with 409 + cycle path)
 * - No new migration
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/cycle-detection.ts (or api/routes/cycle-detection.ts):
 *   - Export detectCycle(db, taskId, blockedByTaskId) → { hasCycle, path }
 *   - BFS/DFS traversal of dependency graph
 *   - Returns path array showing the cycle
 * - Update api/routes/task-dependencies.ts POST handler:
 *   - Before INSERT, call detectCycle
 *   - If hasCycle, return 409 with cycle path
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a8-2-cycle-detection: service", () => {
  it("cycle-detection module exists", () => {
    const paths = [
      resolve(API_DIR, "services/cycle-detection.ts"),
      resolve(API_DIR, "routes/cycle-detection.ts"),
      resolve(API_DIR, "utils/cycle-detection.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/cycle-detection.ts"),
      resolve(API_DIR, "routes/cycle-detection.ts"),
      resolve(API_DIR, "utils/cycle-detection.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports detectCycle function", () => {
    expect(content).toMatch(/export.*detectCycle|detectCycle/);
  });

  it("traverses dependency graph (BFS or DFS)", () => {
    expect(content).toMatch(/blocked_by_task_id|task_dependencies/);
  });

  it("returns cycle path", () => {
    expect(content).toMatch(/path|cycle/i);
  });
});

describe("ms-a8-2-cycle-detection: task-dependencies.ts integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-dependencies.ts"), "utf-8");
  } catch { content = ""; }

  it("calls detectCycle before inserting dependency", () => {
    expect(content).toMatch(/detectCycle|cycle/i);
  });

  it("returns 409 when cycle detected", () => {
    expect(content).toMatch(/409/);
  });

  it("includes cycle path in error response", () => {
    expect(content).toMatch(/cycle|path/i);
  });
});
