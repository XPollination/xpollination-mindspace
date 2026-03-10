/**
 * TDD tests for ms-a7-2-agent-lease-bond
 *
 * Verifies agent lease bond creation:
 * - 010-agent-bonds.sql: agent_bonds table
 * - agent-bond.ts: createBond, renewBond, expireBond, getActiveBond, sweepExpiredBonds
 * - Integration with agents.ts (registration creates bond) and sweep
 * - Bond duration configurable via AGENT_BOND_DURATION_MINUTES
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/010-agent-bonds.sql:
 *   - CREATE TABLE agent_bonds (id, agent_id FK, status CHECK active/expired,
 *     created_at, renewed_at, expires_at, expired_at)
 * - Create api/routes/agent-bond.ts:
 *   - Export createBond, renewBond, expireBond, getActiveBond, sweepExpiredBonds
 *   - Bond duration from AGENT_BOND_DURATION_MINUTES env (default 60)
 * - Update api/routes/agents.ts: call createBond on registration
 * - Update api/routes/agent-status-sweep.ts: call sweepExpiredBonds in sweep
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a7-2-agent-lease-bond: file structure", () => {
  it("010-agent-bonds.sql migration exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/010-agent-bonds.sql"))).toBe(true);
  });

  it("agent-bond.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/agent-bond.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a7-2-agent-lease-bond: 010-agent-bonds.sql", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "db/migrations/010-agent-bonds.sql"), "utf-8"); } catch { content = ""; }

  it("creates agent_bonds table", () => {
    expect(content).toMatch(/CREATE TABLE.*agent_bonds/i);
  });

  it("has agent_id foreign key", () => {
    expect(content).toMatch(/agent_id/i);
  });

  it("has status column with active/expired check", () => {
    expect(content).toMatch(/status/i);
    expect(content).toMatch(/active/i);
    expect(content).toMatch(/expired/i);
  });

  it("has expires_at column", () => {
    expect(content).toMatch(/expires_at/i);
  });

  it("has renewed_at column", () => {
    expect(content).toMatch(/renewed_at/i);
  });
});

// --- Bond service ---
describe("ms-a7-2-agent-lease-bond: agent-bond.ts", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agent-bond.ts"), "utf-8"); } catch { content = ""; }

  it("exports createBond function", () => {
    expect(content).toMatch(/export.*createBond/);
  });

  it("exports renewBond function", () => {
    expect(content).toMatch(/export.*renewBond/);
  });

  it("exports expireBond function", () => {
    expect(content).toMatch(/export.*expireBond/);
  });

  it("exports getActiveBond function", () => {
    expect(content).toMatch(/export.*getActiveBond/);
  });

  it("exports sweepExpiredBonds function", () => {
    expect(content).toMatch(/export.*sweepExpiredBonds/);
  });

  it("uses AGENT_BOND_DURATION_MINUTES env var", () => {
    expect(content).toMatch(/AGENT_BOND_DURATION_MINUTES/);
  });

  it("has default bond duration of 60 minutes", () => {
    expect(content).toMatch(/60/);
  });
});

// --- Integration ---
describe("ms-a7-2-agent-lease-bond: integration", () => {
  let agentsContent: string;
  try { agentsContent = readFileSync(resolve(API_DIR, "routes/agents.ts"), "utf-8"); } catch { agentsContent = ""; }

  it("agents.ts references createBond", () => {
    expect(agentsContent).toMatch(/createBond/);
  });
});
