/**
 * TDD tests for ms-a11-1-agent-card
 *
 * Verifies Agent Card endpoint:
 * - api/routes/agent-card.ts with static Agent Card JSON
 * - Mounted at /.well-known/agent.json
 * - Contains all required fields per REQ-A2A-001
 * - No authentication required
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/agent-card.ts with agentCardRouter export
 * - Static AGENT_CARD object with: name, description, version, protocol,
 *   capabilities (6), authentication (type, header, registration_url),
 *   endpoints (connect, message, stream), digital_twin_schema, available_projects
 * - Modify api/server.ts: mount at /.well-known/agent.json
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a11-1-agent-card: file structure", () => {
  it("api/routes/agent-card.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/agent-card.ts"))).toBe(true);
  });
});

// --- Agent Card route ---
describe("ms-a11-1-agent-card: agent-card.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/agent-card.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports agentCardRouter", () => {
    expect(content).toMatch(/export.*agentCardRouter/);
  });

  it("contains name: Mindspace Orchestrator", () => {
    expect(content).toMatch(/Mindspace Orchestrator/);
  });

  it("contains protocol: xpo-a2a-v1", () => {
    expect(content).toMatch(/xpo-a2a-v1/);
  });

  it("contains version: 1.0", () => {
    expect(content).toMatch(/['"]1\.0['"]/);
  });

  it("lists task_management capability", () => {
    expect(content).toMatch(/task_management/);
  });

  it("lists requirement_crud capability", () => {
    expect(content).toMatch(/requirement_crud/);
  });

  it("lists focus_control capability", () => {
    expect(content).toMatch(/focus_control/);
  });

  it("lists transitions capability", () => {
    expect(content).toMatch(/transitions/);
  });

  it("lists feature_flags capability", () => {
    expect(content).toMatch(/feature_flags/);
  });

  it("lists marketplace capability", () => {
    expect(content).toMatch(/marketplace/);
  });

  it("specifies api_key authentication type", () => {
    expect(content).toMatch(/api_key/);
  });

  it("specifies X-API-Key header", () => {
    expect(content).toMatch(/X-API-Key/);
  });

  it("contains connect endpoint", () => {
    expect(content).toMatch(/a2a\/connect/);
  });

  it("contains message endpoint", () => {
    expect(content).toMatch(/a2a\/message/);
  });

  it("contains stream endpoint with agent_id template", () => {
    expect(content).toMatch(/a2a\/stream/);
  });

  it("contains digital_twin_schema URL", () => {
    expect(content).toMatch(/digital_twin_schema/);
  });

  it("contains available_projects URL", () => {
    expect(content).toMatch(/available_projects/);
  });
});

// --- Server integration ---
describe("ms-a11-1-agent-card: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports agentCardRouter", () => {
    expect(content).toMatch(/import.*agentCardRouter.*from/);
  });

  it("mounts at /.well-known/agent.json", () => {
    expect(content).toMatch(/\.well-known\/agent\.json/);
  });
});
