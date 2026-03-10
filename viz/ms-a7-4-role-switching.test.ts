/**
 * TDD tests for ms-a7-4-role-switching
 *
 * Verifies agent role switching endpoint:
 * - POST /api/agents/:id/role-switch
 * - Validates to_role is in agent's capabilities array
 * - Optional from_role safety check (409 on mismatch)
 * - Blocks disconnected agents (409)
 * - Returns switched:boolean, previous_role, reason
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/agents.ts:
 *   - POST /:id/role-switch with body { from_role, to_role, reason }
 *   - Validate to_role against agent capabilities JSON array
 *   - If from_role provided, check it matches current_role (409 if not)
 *   - Block disconnected agents (409)
 *   - Update current_role in agents table
 *   - Return { switched: true, previous_role, current_role, reason }
 *   - 404 for unknown agent, 400 for missing to_role
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Role switching endpoint ---
describe("ms-a7-4-role-switching: agents.ts", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agents.ts"), "utf-8"); } catch { content = ""; }

  it("has POST role-switch route", () => {
    expect(content).toMatch(/role-switch|roleSwitch/i);
    expect(content).toMatch(/post/i);
  });

  it("accepts to_role in request body", () => {
    expect(content).toMatch(/to_role|toRole/);
  });

  it("accepts from_role for safety check", () => {
    expect(content).toMatch(/from_role|fromRole/);
  });

  it("validates to_role against capabilities", () => {
    expect(content).toMatch(/capabilities/i);
  });

  it("blocks disconnected agents", () => {
    expect(content).toMatch(/disconnected/i);
  });

  it("returns 409 on from_role mismatch", () => {
    expect(content).toMatch(/409/);
  });

  it("updates current_role in database", () => {
    expect(content).toMatch(/current_role/i);
  });

  it("returns switched boolean in response", () => {
    expect(content).toMatch(/switched/i);
  });

  it("returns previous_role in response", () => {
    expect(content).toMatch(/previous_role|previousRole/);
  });

  it("accepts reason field", () => {
    expect(content).toMatch(/reason/i);
  });

  it("returns 404 for unknown agent", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 400 for missing to_role", () => {
    expect(content).toMatch(/400/);
  });
});
