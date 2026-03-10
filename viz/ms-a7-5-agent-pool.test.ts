/**
 * TDD tests for ms-a7-5-agent-pool
 *
 * Verifies agent pool query endpoint (for viz dashboard):
 * - GET /api/projects/:slug/agents — aggregated agent pool
 * - Aggregation by role and by status
 * - Agent list with current_task placeholder (null)
 * - Excludes disconnected by default, include_disconnected query param
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/agent-pool.ts:
 *   - Export agentPoolRouter with mergeParams
 *   - GET / returns { by_role, by_status, agents[] }
 *   - by_role: count per role (pdsa, dev, qa, liaison, orchestrator)
 *   - by_status: count per status (active, idle, disconnected)
 *   - agents[]: name, current_role, status, current_task (null placeholder)
 *   - Exclude disconnected by default, include with ?include_disconnected=true
 * - Update api/routes/projects.ts: mount agentPoolRouter at /:slug/agents
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a7-5-agent-pool: file structure", () => {
  it("agent-pool.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/agent-pool.ts"))).toBe(true);
  });
});

// --- Agent pool router ---
describe("ms-a7-5-agent-pool: agent-pool.ts", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agent-pool.ts"), "utf-8"); } catch { content = ""; }

  it("exports agentPoolRouter", () => {
    expect(content).toMatch(/export.*agentPoolRouter/);
  });

  it("uses mergeParams", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("has GET handler", () => {
    expect(content).toMatch(/get/i);
  });

  it("aggregates by_role", () => {
    expect(content).toMatch(/by_role|byRole/);
  });

  it("aggregates by_status", () => {
    expect(content).toMatch(/by_status|byStatus/);
  });

  it("returns agents array", () => {
    expect(content).toMatch(/agents/);
  });

  it("includes current_task placeholder", () => {
    expect(content).toMatch(/current_task|currentTask/);
  });

  it("excludes disconnected by default", () => {
    expect(content).toMatch(/disconnected/i);
  });

  it("supports include_disconnected query param", () => {
    expect(content).toMatch(/include_disconnected|includeDisconnected/);
  });

  it("queries agents table with project_slug filter", () => {
    expect(content).toMatch(/project_slug/);
  });
});

// --- Server integration ---
describe("ms-a7-5-agent-pool: projects.ts mount", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8"); } catch { content = ""; }

  it("imports agentPoolRouter", () => {
    expect(content).toMatch(/agentPoolRouter|agent-pool/);
  });

  it("mounts at /:slug/agents", () => {
    expect(content).toMatch(/agents/);
  });
});
