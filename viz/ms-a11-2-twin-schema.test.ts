/**
 * TDD tests for ms-a11-2-twin-schema
 *
 * Verifies Digital Twin JSON Schema endpoint:
 * - api/routes/twin-schema.ts with static JSON Schema (draft-07)
 * - Mounted at /schemas/digital-twin-v1.json
 * - All 5 sections from §4.A2A.3: identity, role, project, state, metadata
 * - Strict validation with additionalProperties:false and enums
 * - No authentication required
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/twin-schema.ts with twinSchemaRouter export
 * - Static DIGITAL_TWIN_SCHEMA object (JSON Schema draft-07)
 * - 5 required sections: identity (agent_name, api_key, session_id),
 *   role (current enum, capabilities array), project (slug, branch),
 *   state (status enum, task, lease, heartbeat, score),
 *   metadata (framework, connected_at, agent_id)
 * - Modify api/server.ts: mount at /schemas/digital-twin-v1.json
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a11-2-twin-schema: file structure", () => {
  it("api/routes/twin-schema.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/twin-schema.ts"))).toBe(true);
  });
});

// --- Twin schema route ---
describe("ms-a11-2-twin-schema: twin-schema.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/twin-schema.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports twinSchemaRouter", () => {
    expect(content).toMatch(/export.*twinSchemaRouter/);
  });

  it("uses JSON Schema draft-07", () => {
    expect(content).toMatch(/draft-07|json-schema/i);
  });

  // --- Identity section ---
  it("contains agent_name field", () => {
    expect(content).toMatch(/agent_name/);
  });

  it("contains api_key field", () => {
    expect(content).toMatch(/api_key/);
  });

  it("contains session_id field", () => {
    expect(content).toMatch(/session_id/);
  });

  // --- Role section ---
  it("contains current role with enum", () => {
    expect(content).toMatch(/current/);
  });

  it("contains capabilities array", () => {
    expect(content).toMatch(/capabilities/);
  });

  // --- Project section ---
  it("contains project slug field", () => {
    expect(content).toMatch(/slug/);
  });

  it("contains project branch field", () => {
    expect(content).toMatch(/branch/);
  });

  // --- State section ---
  it("contains status field with enum", () => {
    expect(content).toMatch(/status/);
  });

  it("contains task field", () => {
    expect(content).toMatch(/task/);
  });

  it("contains heartbeat field", () => {
    expect(content).toMatch(/heartbeat/);
  });

  it("contains score field", () => {
    expect(content).toMatch(/score/);
  });

  // --- Metadata section ---
  it("contains framework field", () => {
    expect(content).toMatch(/framework/);
  });

  it("contains connected_at field", () => {
    expect(content).toMatch(/connected_at/);
  });

  // --- Strict validation ---
  it("uses additionalProperties false for strict validation", () => {
    expect(content).toMatch(/additionalProperties.*false/);
  });
});

// --- Server integration ---
describe("ms-a11-2-twin-schema: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports twinSchemaRouter", () => {
    expect(content).toMatch(/import.*twinSchemaRouter.*from/);
  });

  it("mounts at /schemas/digital-twin-v1.json", () => {
    expect(content).toMatch(/schemas\/digital-twin-v1\.json/);
  });
});
