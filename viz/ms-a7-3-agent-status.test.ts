/**
 * TDD tests for ms-a7-3-agent-status
 *
 * Verifies agent status lifecycle (active/idle/disconnected):
 * - POST /api/agents/:id/heartbeat — updates last_seen, reactivates idle
 * - PATCH /api/agents/:id/status — manual status change (graceful disconnect)
 * - agent-status-sweep.ts: background sweep with configurable thresholds
 * - Env vars: AGENT_IDLE_MINUTES, AGENT_DISCONNECT_MINUTES
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/agents.ts:
 *   - POST /:id/heartbeat — update last_seen, reactivate idle agents
 *   - PATCH /:id/status — manual status updates, set disconnected_at
 * - Create api/routes/agent-status-sweep.ts:
 *   - Export startAgentSweep (or sweepAgentStatuses)
 *   - setInterval(60s) background job
 *   - active→idle after AGENT_IDLE_MINUTES (default 5)
 *   - idle→disconnected after AGENT_DISCONNECT_MINUTES (default 30)
 *   - Set disconnected_at timestamp on disconnect
 * - Update api/server.ts: start sweep on server init
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a7-3-agent-status: file structure", () => {
  it("agent-status-sweep.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/agent-status-sweep.ts"))).toBe(true);
  });
});

// --- Heartbeat endpoint ---
describe("ms-a7-3-agent-status: agents.ts heartbeat", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agents.ts"), "utf-8"); } catch { content = ""; }

  it("has POST heartbeat route", () => {
    expect(content).toMatch(/heartbeat/i);
    expect(content).toMatch(/post/i);
  });

  it("updates last_seen on heartbeat", () => {
    expect(content).toMatch(/last_seen/i);
  });

  it("reactivates idle agents on heartbeat", () => {
    // Should check if agent is idle and set back to active
    expect(content).toMatch(/idle/i);
  });
});

// --- Manual status change ---
describe("ms-a7-3-agent-status: agents.ts manual status", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agents.ts"), "utf-8"); } catch { content = ""; }

  it("has PATCH status route", () => {
    expect(content).toMatch(/patch/i);
    expect(content).toMatch(/status/i);
  });

  it("sets disconnected_at on disconnect", () => {
    expect(content).toMatch(/disconnected_at/i);
  });
});

// --- Background sweep ---
describe("ms-a7-3-agent-status: agent-status-sweep.ts", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "routes/agent-status-sweep.ts"), "utf-8"); } catch { content = ""; }

  it("exports sweep function", () => {
    expect(content).toMatch(/export.*(?:startAgentSweep|sweepAgentStatuses|agentSweep)/);
  });

  it("uses setInterval for background job", () => {
    expect(content).toMatch(/setInterval/);
  });

  it("uses AGENT_IDLE_MINUTES env var", () => {
    expect(content).toMatch(/AGENT_IDLE_MINUTES/);
  });

  it("uses AGENT_DISCONNECT_MINUTES env var", () => {
    expect(content).toMatch(/AGENT_DISCONNECT_MINUTES/);
  });

  it("has default idle threshold of 5 minutes", () => {
    expect(content).toMatch(/5/);
  });

  it("has default disconnect threshold of 30 minutes", () => {
    expect(content).toMatch(/30/);
  });

  it("transitions active to idle", () => {
    expect(content).toMatch(/active/i);
    expect(content).toMatch(/idle/i);
  });

  it("transitions idle to disconnected", () => {
    expect(content).toMatch(/disconnected/i);
  });
});

// --- Server integration ---
describe("ms-a7-3-agent-status: server.ts integration", () => {
  let content: string;
  try { content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8"); } catch { content = ""; }

  it("imports or references sweep", () => {
    expect(content).toMatch(/sweep|startAgentSweep/i);
  });
});
