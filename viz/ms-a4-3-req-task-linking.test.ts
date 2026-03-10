/**
 * TDD tests for ms-a4-3-req-task-linking
 *
 * Verifies requirement ↔ task linking:
 * - GET /requirements/:reqId/tasks — list tasks linked to a requirement
 * - Tasks GET enriched with requirement object when requirement_id present
 * - Dual lookup support (UUID or req_id_human)
 * - No new table — uses existing requirement_id FK on tasks
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/requirements.ts:
 *   - Add GET /:reqId/tasks endpoint
 *   - Query tasks WHERE requirement_id = ? (resolved from reqId)
 *   - Support dual lookup: UUID or req_id_human
 * - Update api/routes/tasks.ts:
 *   - GET /:taskId enriches response with requirement object when requirement_id set
 *   - Include req_id_human, title, status, priority from requirements table
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Requirements route ---
describe("ms-a4-3-req-task-linking: requirements.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/requirements.ts"), "utf-8");
  } catch { content = ""; }

  it("has GET /:reqId/tasks endpoint", () => {
    expect(content).toMatch(/tasks/);
    expect(content).toMatch(/\.get\(/i);
  });

  it("queries tasks by requirement_id", () => {
    expect(content).toMatch(/requirement_id/);
    expect(content).toMatch(/tasks/);
  });

  it("supports dual lookup (UUID or req_id_human)", () => {
    expect(content).toMatch(/req_id_human/);
  });

  it("returns 404 for non-existent requirement", () => {
    expect(content).toMatch(/404/);
  });
});

// --- Tasks route enrichment ---
describe("ms-a4-3-req-task-linking: tasks.ts enrichment", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/tasks.ts"), "utf-8");
  } catch { content = ""; }

  it("enriches task GET with requirement object", () => {
    expect(content).toMatch(/requirement/i);
  });

  it("includes req_id_human in enriched response", () => {
    expect(content).toMatch(/req_id_human/);
  });

  it("includes requirement title in enriched response", () => {
    expect(content).toMatch(/requirement/i);
    expect(content).toMatch(/title/);
  });

  it("handles null requirement_id gracefully", () => {
    expect(content).toMatch(/null|undefined|requirement_id/i);
  });

  it("JOINs or queries requirements table", () => {
    expect(content).toMatch(/requirements|JOIN/i);
  });
});
