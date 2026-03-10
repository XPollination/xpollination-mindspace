/**
 * TDD tests for ms-a11-5-a2a-message-router
 *
 * Verifies A2A message router (POST /a2a/message):
 * - Unified message endpoint with type-based dispatch
 * - Validation: agent_id required, type required, type must be known
 * - Agent lookup (404) and disconnected check (409)
 * - HEARTBEAT: ACK, updates last_seen, reactivates idle, renews bond
 * - ROLE_SWITCH: ACK, validates to_role, from_role mismatch 409, capabilities 403
 * - DISCONNECT: ACK, sets disconnected, expires bond
 * - CLAIM_TASK/TRANSITION/RELEASE_TASK: 501 stubs
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/a2a-message.ts:
 *   - Export a2aMessageRouter
 *   - POST / handler: validate agent_id + type → lookup agent → check not disconnected → dispatch
 *   - MESSAGE_HANDLERS map: HEARTBEAT, ROLE_SWITCH, DISCONNECT, CLAIM_TASK, TRANSITION, RELEASE_TASK
 *   - HEARTBEAT: update last_seen, reactivate idle→active, renewBond(agent_id)
 *   - ROLE_SWITCH: validate to_role in VALID_ROLES, from_role mismatch check, capabilities check
 *   - DISCONNECT: set status=disconnected, expireBond
 *   - CLAIM_TASK/TRANSITION/RELEASE_TASK: 501 not implemented
 *   - ACK response: { type: "ACK", original_type, agent_id, ...fields, timestamp }
 *   - ERROR response: { type: "ERROR", error: "message" }
 * - Update api/server.ts: mount a2aMessageRouter at /a2a/message
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a11-5-a2a-message-router: file structure", () => {
  it("api/routes/a2a-message.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/a2a-message.ts"))).toBe(true);
  });
});

// --- Router exports and validation ---
describe("ms-a11-5-a2a-message-router: a2a-message.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8");
  } catch { content = ""; }

  it("exports a2aMessageRouter", () => {
    expect(content).toMatch(/export.*a2aMessageRouter/);
  });

  it("has POST handler", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("validates agent_id is present (400)", () => {
    expect(content).toMatch(/agent_id/);
    expect(content).toMatch(/400/);
  });

  it("validates type is present (400)", () => {
    expect(content).toMatch(/type/);
    expect(content).toMatch(/400/);
  });

  it("validates type against known message types (400)", () => {
    expect(content).toMatch(/HEARTBEAT/);
    expect(content).toMatch(/ROLE_SWITCH/);
    expect(content).toMatch(/DISCONNECT/);
    expect(content).toMatch(/CLAIM_TASK/);
    expect(content).toMatch(/TRANSITION/);
    expect(content).toMatch(/RELEASE_TASK/);
  });

  it("looks up agent in database (404)", () => {
    expect(content).toMatch(/404/);
    expect(content).toMatch(/agent.*not.*found|not.*found/i);
  });

  it("blocks disconnected agents (409)", () => {
    expect(content).toMatch(/disconnected/i);
    expect(content).toMatch(/409/);
  });

  it("uses MESSAGE_HANDLERS or dispatch map", () => {
    expect(content).toMatch(/MESSAGE_HANDLERS|HANDLERS|handler/i);
  });
});

// --- HEARTBEAT handler ---
describe("ms-a11-5-a2a-message-router: HEARTBEAT", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8");
  } catch { content = ""; }

  it("returns ACK with original_type HEARTBEAT", () => {
    expect(content).toMatch(/ACK/);
    expect(content).toMatch(/original_type/);
  });

  it("updates last_seen", () => {
    expect(content).toMatch(/last_seen/);
  });

  it("reactivates idle agent to active", () => {
    expect(content).toMatch(/idle/i);
    expect(content).toMatch(/active/i);
  });

  it("renews bond via renewBond", () => {
    expect(content).toMatch(/renewBond/);
  });
});

// --- ROLE_SWITCH handler ---
describe("ms-a11-5-a2a-message-router: ROLE_SWITCH", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8");
  } catch { content = ""; }

  it("returns ACK with previous_role and current_role", () => {
    expect(content).toMatch(/previous_role|previousRole/);
    expect(content).toMatch(/current_role|currentRole/);
  });

  it("validates to_role is required (400)", () => {
    expect(content).toMatch(/to_role|toRole/);
    expect(content).toMatch(/400/);
  });

  it("validates to_role against VALID_ROLES (400)", () => {
    expect(content).toMatch(/VALID_ROLES|valid.*roles/i);
  });

  it("checks from_role mismatch (409)", () => {
    expect(content).toMatch(/from_role|fromRole/);
    expect(content).toMatch(/mismatch|409/i);
  });

  it("checks capabilities for role switch (403)", () => {
    expect(content).toMatch(/capabilities/i);
    expect(content).toMatch(/403/);
  });
});

// --- DISCONNECT handler ---
describe("ms-a11-5-a2a-message-router: DISCONNECT", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8");
  } catch { content = ""; }

  it("returns ACK with status disconnected", () => {
    expect(content).toMatch(/ACK/);
    expect(content).toMatch(/disconnected/i);
  });

  it("expires active bond", () => {
    expect(content).toMatch(/expireBond|expire.*bond/i);
  });
});

// --- Stub handlers ---
describe("ms-a11-5-a2a-message-router: stub handlers", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-message.ts"), "utf-8");
  } catch { content = ""; }

  it("CLAIM_TASK returns 501 not implemented", () => {
    expect(content).toMatch(/501/);
    expect(content).toMatch(/not.*implemented/i);
  });

  it("TRANSITION type is registered", () => {
    expect(content).toMatch(/TRANSITION/);
  });

  it("RELEASE_TASK type is registered", () => {
    expect(content).toMatch(/RELEASE_TASK/);
  });
});

// --- Server mount ---
describe("ms-a11-5-a2a-message-router: server.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch { content = ""; }

  it("imports a2aMessageRouter", () => {
    expect(content).toMatch(/a2aMessageRouter|a2a-message/);
  });

  it("mounts at /a2a/message", () => {
    expect(content).toMatch(/\/a2a\/message/);
  });
});
