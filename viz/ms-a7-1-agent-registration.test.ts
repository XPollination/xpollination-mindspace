/**
 * TDD tests for ms-a7-1-agent-registration
 *
 * Verifies agents table + registration endpoint:
 * - 008 migration: agents table (id, user_id FK, name, current_role, capabilities JSON,
 *   project_slug FK nullable, session_id, status CHECK, connected_at, last_seen, disconnected_at)
 * - POST /api/agents/register: register/re-register agent
 * - GET /api/agents: list with optional filters
 * - GET /api/agents/:id: individual agent
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/008-agents.sql:
 *   - agents: id UUID, user_id FK→users(id), name TEXT, current_role TEXT,
 *     capabilities TEXT (JSON), project_slug FK→projects(slug) nullable,
 *     session_id TEXT, status CHECK (active/idle/disconnected),
 *     connected_at, last_seen, disconnected_at
 * - Create api/routes/agents.ts:
 *   - Export agentsRouter
 *   - POST /register: create or re-register (update existing non-disconnected)
 *   - GET /: list agents, optional ?project_slug=&status= filters
 *   - GET /:id: get agent by id
 *   - Behind requireApiKeyOrJwt
 * - Update api/server.ts: mount agentsRouter at /api/agents
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a7-1-agent-registration: file structure", () => {
  it("api/db/migrations/008-agents.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/008-agents.sql"))).toBe(true);
  });

  it("api/routes/agents.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/agents.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a7-1-agent-registration: 008-agents.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/008-agents.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates agents table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*agents/i);
  });

  it("has user_id foreign key", () => {
    expect(content).toMatch(/user_id/i);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has name column", () => {
    expect(content).toMatch(/\bname\b/i);
  });

  it("has current_role column", () => {
    expect(content).toMatch(/current_role/i);
  });

  it("has capabilities column (JSON)", () => {
    expect(content).toMatch(/capabilities/i);
  });

  it("has project_slug column (nullable FK)", () => {
    expect(content).toMatch(/project_slug/i);
  });

  it("has session_id column", () => {
    expect(content).toMatch(/session_id/i);
  });

  it("has status with CHECK constraint", () => {
    expect(content).toMatch(/status/i);
    expect(content).toMatch(/CHECK/i);
  });

  it("status allows active/idle/disconnected", () => {
    expect(content).toMatch(/active/i);
    expect(content).toMatch(/idle/i);
    expect(content).toMatch(/disconnected/i);
  });

  it("has connected_at column", () => {
    expect(content).toMatch(/connected_at/i);
  });

  it("has last_seen column", () => {
    expect(content).toMatch(/last_seen/i);
  });

  it("has disconnected_at column", () => {
    expect(content).toMatch(/disconnected_at/i);
  });
});

// --- Agents route ---
describe("ms-a7-1-agent-registration: agents.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/agents.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports agentsRouter", () => {
    expect(content).toMatch(/export.*agentsRouter/);
  });

  it("uses auth middleware", () => {
    expect(content).toMatch(/requireApiKeyOrJwt|requireAuth|auth/i);
  });

  it("handles POST /register", () => {
    expect(content).toMatch(/register/i);
    expect(content).toMatch(/post/i);
  });

  it("handles GET for listing agents", () => {
    expect(content).toMatch(/get/i);
  });

  it("supports project_slug filter", () => {
    expect(content).toMatch(/project_slug/i);
  });

  it("supports status filter", () => {
    expect(content).toMatch(/status/i);
  });

  it("handles re-registration for agent restarts", () => {
    // Should update existing non-disconnected agent
    expect(content).toMatch(/update|upsert|existing|re.?register/i);
  });

  it("returns 201 on registration", () => {
    expect(content).toMatch(/201/);
  });
});

// --- Server integration ---
describe("ms-a7-1-agent-registration: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports agentsRouter", () => {
    expect(content).toMatch(/import.*agentsRouter.*from/);
  });

  it("mounts at /api/agents", () => {
    expect(content).toMatch(/\/api\/agents/);
  });
});
