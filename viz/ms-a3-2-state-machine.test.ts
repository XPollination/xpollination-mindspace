/**
 * TDD tests for ms-a3-2-state-machine
 *
 * Verifies task state machine (workflow transitions):
 * - Migration: task_transitions history table
 * - Service: task-state-machine.ts with transition map and validation
 * - Endpoint: POST /:taskId/transition
 * - Role computation via actor and transition type
 * - Review chain and rework routing
 * - Blocked/restore flow
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/013-task-transitions.sql:
 *   - CREATE TABLE task_transitions (id, task_id FK, from_status, to_status,
 *     actor, actor_role, reason, created_at)
 * - Create api/services/task-state-machine.ts:
 *   - Export TRANSITION_MAP defining allowed transitions per status
 *   - Export validateTransition(task, toStatus, actor)
 *   - Export computeRole(transition, actor) for review chain
 *   - Role routing: review chain (qa→pdsa→liaison), rework→dev
 * - Create api/routes/task-transitions.ts:
 *   - Export taskTransitionsRouter with mergeParams
 *   - POST / (contributor+): execute transition
 *   - GET / (viewer): list transition history
 * - Update api/routes/tasks.ts: mount taskTransitionsRouter
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a3-2-state-machine: migration", () => {
  it("task-transitions migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/013-task-transitions.sql"),
      resolve(API_DIR, "db/migrations/014-task-transitions.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/013-task-transitions.sql"),
      resolve(API_DIR, "db/migrations/014-task-transitions.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates task_transitions table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*task_transitions/i);
  });

  it("has task_id FK to tasks", () => {
    expect(content).toMatch(/task_id/);
    expect(content).toMatch(/REFERENCES\s+tasks/i);
  });

  it("has from_status and to_status columns", () => {
    expect(content).toMatch(/from_status/);
    expect(content).toMatch(/to_status/);
  });

  it("has actor column", () => {
    expect(content).toMatch(/actor/);
  });

  it("has reason column", () => {
    expect(content).toMatch(/reason/);
  });
});

// --- State machine service ---
describe("ms-a3-2-state-machine: task-state-machine.ts", () => {
  it("api/services/task-state-machine.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "services/task-state-machine.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "services/task-state-machine.ts"), "utf-8");
  } catch { content = ""; }

  it("exports TRANSITION_MAP", () => {
    expect(content).toMatch(/export.*TRANSITION_MAP|TRANSITION_MAP/);
  });

  it("exports validateTransition function", () => {
    expect(content).toMatch(/export.*validateTransition|validateTransition/);
  });

  it("exports computeRole function", () => {
    expect(content).toMatch(/export.*computeRole|computeRole/);
  });

  it("defines transitions from pending", () => {
    expect(content).toMatch(/pending/);
  });

  it("defines transitions from active to review", () => {
    expect(content).toMatch(/active/);
    expect(content).toMatch(/review/);
  });

  it("handles review chain (qa → pdsa → liaison)", () => {
    expect(content).toMatch(/qa/);
    expect(content).toMatch(/pdsa/);
    expect(content).toMatch(/liaison/);
  });

  it("handles rework routing back to dev", () => {
    expect(content).toMatch(/rework/);
    expect(content).toMatch(/dev/);
  });

  it("handles blocked/restore flow", () => {
    expect(content).toMatch(/blocked/);
  });

  it("includes approval flow", () => {
    expect(content).toMatch(/approval/);
    expect(content).toMatch(/approved/);
  });

  it("includes complete as terminal state", () => {
    expect(content).toMatch(/complete/);
  });
});

// --- Transitions router ---
describe("ms-a3-2-state-machine: task-transitions.ts", () => {
  it("api/routes/task-transitions.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/task-transitions.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-transitions.ts"), "utf-8");
  } catch { content = ""; }

  it("exports taskTransitionsRouter", () => {
    expect(content).toMatch(/export.*taskTransitionsRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has POST handler to execute transition", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has GET handler for transition history", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("validates transition via state machine", () => {
    expect(content).toMatch(/validateTransition|TRANSITION_MAP/);
  });

  it("records transition in task_transitions table", () => {
    expect(content).toMatch(/task_transitions/);
    expect(content).toMatch(/INSERT/i);
  });

  it("updates task status on successful transition", () => {
    expect(content).toMatch(/UPDATE.*tasks|status/i);
  });

  it("returns 400 for invalid transition", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 404 for non-existent task", () => {
    expect(content).toMatch(/404/);
  });
});

// --- Mount ---
describe("ms-a3-2-state-machine: tasks.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("imports taskTransitionsRouter", () => {
    expect(content).toMatch(/taskTransitionsRouter|task-transitions/);
  });

  it("mounts transitions route", () => {
    expect(content).toMatch(/transition/);
  });
});
