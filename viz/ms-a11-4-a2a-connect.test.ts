/**
 * TDD tests for ms-a11-4-a2a-connect
 *
 * Verifies A2A connect endpoint (CHECKIN handler):
 * - POST /a2a/connect accepts filled digital twin
 * - Validates twin structure (identity, role, project, state, metadata)
 * - Authenticates via identity.api_key (SHA-256 hash lookup)
 * - Checks project access (project_access table)
 * - Validates role against allowed roles
 * - Registers agent (new or re-registration)
 * - Returns WELCOME message with agent_id, session_id, endpoints
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/a2a-connect.ts:
 *   - Export a2aConnectRouter
 *   - POST / handler: twin validation → auth → access → register → WELCOME
 *   - API key from twin.identity.api_key (NOT X-API-Key header)
 *   - SHA-256 hash for key lookup in api_keys table
 *   - JOIN users to resolve user_id
 *   - Check project_access for user_id + project_slug
 *   - Register: INSERT new or UPDATE existing agent (re-registration)
 *   - WELCOME response: type, agent_id, session_id, reconnect, project, endpoints
 *   - ERROR responses: type: 'ERROR', error message
 *   - Status codes: 200 (WELCOME), 400, 401, 403, 404
 * - Update api/server.ts: mount a2aConnectRouter at /a2a/connect
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a11-4-a2a-connect: file structure", () => {
  it("api/routes/a2a-connect.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/a2a-connect.ts"))).toBe(true);
  });
});

// --- A2A connect route ---
describe("ms-a11-4-a2a-connect: a2a-connect.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-connect.ts"), "utf-8");
  } catch { content = ""; }

  it("exports a2aConnectRouter", () => {
    expect(content).toMatch(/export.*a2aConnectRouter/);
  });

  it("handles POST request", () => {
    expect(content).toMatch(/\.post\s*\(/);
  });

  // --- Twin validation ---
  it("validates twin has identity section", () => {
    expect(content).toMatch(/identity/);
  });

  it("validates twin has role section", () => {
    expect(content).toMatch(/role/);
  });

  it("validates twin has project section", () => {
    expect(content).toMatch(/project/);
  });

  it("validates twin has state section", () => {
    expect(content).toMatch(/state/);
  });

  it("validates twin has metadata section", () => {
    expect(content).toMatch(/metadata/);
  });

  // --- Authentication ---
  it("reads API key from twin identity.api_key", () => {
    expect(content).toMatch(/api_key|apiKey/);
    expect(content).toMatch(/identity/);
  });

  it("uses SHA-256 to hash API key", () => {
    expect(content).toMatch(/sha256|SHA-256/i);
    expect(content).toMatch(/createHash|crypto/);
  });

  it("looks up key_hash in api_keys table", () => {
    expect(content).toMatch(/api_keys/);
    expect(content).toMatch(/key_hash/);
  });

  it("JOINs users table to resolve user", () => {
    expect(content).toMatch(/JOIN\s+users/i);
  });

  it("checks for revoked API key", () => {
    expect(content).toMatch(/revoked_at|revoked/);
  });

  // --- Authorization ---
  it("checks project_access table for membership", () => {
    expect(content).toMatch(/project_access/);
  });

  it("validates role against VALID_ROLES", () => {
    expect(content).toMatch(/VALID_ROLES|valid.*role/i);
  });

  it("checks project exists in projects table", () => {
    expect(content).toMatch(/projects.*slug|SELECT.*FROM.*projects/i);
  });

  // --- Agent registration ---
  it("registers agent with INSERT", () => {
    expect(content).toMatch(/INSERT.*agents/i);
  });

  it("handles re-registration with UPDATE", () => {
    expect(content).toMatch(/UPDATE.*agents/i);
  });

  it("sets agent status to active on connect", () => {
    expect(content).toMatch(/active/);
  });

  // --- WELCOME response ---
  it("returns type: WELCOME", () => {
    expect(content).toMatch(/WELCOME/);
  });

  it("returns agent_id in response", () => {
    expect(content).toMatch(/agent_id/);
  });

  it("returns session_id in response", () => {
    expect(content).toMatch(/session_id/);
  });

  it("returns reconnect flag", () => {
    expect(content).toMatch(/reconnect/);
  });

  it("returns stream endpoint URL", () => {
    expect(content).toMatch(/stream/);
    expect(content).toMatch(/endpoints/);
  });

  // --- Error handling ---
  it("returns type: ERROR for failures", () => {
    expect(content).toMatch(/ERROR/);
  });

  it("returns 400 for invalid twin", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 401 for invalid API key", () => {
    expect(content).toMatch(/401/);
  });

  it("returns 403 for access denied", () => {
    expect(content).toMatch(/403/);
  });

  it("returns 404 for project not found", () => {
    expect(content).toMatch(/404/);
  });
});

// --- Server integration ---
describe("ms-a11-4-a2a-connect: server mount", () => {
  let serverContent: string;
  try { serverContent = readFileSync(resolve(API_DIR, "server.ts"), "utf-8"); } catch { serverContent = ""; }

  it("imports a2aConnectRouter", () => {
    expect(serverContent).toMatch(/a2aConnectRouter|a2a-connect/i);
  });

  it("mounts at /a2a/connect", () => {
    expect(serverContent).toMatch(/\/a2a\/connect/);
  });
});
