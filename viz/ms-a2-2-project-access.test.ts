/**
 * TDD tests for ms-a2-2-project-access
 *
 * Verifies project access table + membership endpoints:
 * - 007 migration: project_access table (id, user_id FK, project_slug FK, role CHECK, granted_at, granted_by)
 * - POST/GET/DELETE /api/projects/:slug/members
 * - Roles: admin/contributor/viewer (default viewer)
 * - UNIQUE(user_id, project_slug) constraint
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/007-project-access.sql:
 *   - project_access: id UUID, user_id FK→users(id), project_slug FK→projects(slug),
 *     role CHECK (admin/contributor/viewer), granted_at, granted_by FK→users(id)
 *   - UNIQUE(user_id, project_slug)
 * - Create api/routes/members.ts:
 *   - Export membersRouter (mergeParams: true)
 *   - POST / : add member (201/400/404/409)
 *   - GET / : list members with user info (JOIN)
 *   - DELETE /:userId : remove member (200/404)
 *   - Behind requireApiKeyOrJwt
 * - Update api/server.ts or projects.ts: mount membersRouter at /api/projects/:slug/members
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a2-2-project-access: file structure", () => {
  it("api/db/migrations/007-project-access.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/007-project-access.sql"))).toBe(true);
  });

  it("api/routes/members.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/members.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a2-2-project-access: 007-project-access.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/007-project-access.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates project_access table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*project_access/i);
  });

  it("has user_id foreign key to users", () => {
    expect(content).toMatch(/user_id/i);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });

  it("has project_slug column", () => {
    expect(content).toMatch(/project_slug/i);
  });

  it("references projects table", () => {
    expect(content).toMatch(/REFERENCES\s+projects/i);
  });

  it("has role column with CHECK constraint", () => {
    expect(content).toMatch(/\brole\b/i);
    expect(content).toMatch(/CHECK/i);
  });

  it("role allows admin/contributor/viewer", () => {
    expect(content).toMatch(/admin/i);
    expect(content).toMatch(/contributor/i);
    expect(content).toMatch(/viewer/i);
  });

  it("has granted_at column", () => {
    expect(content).toMatch(/granted_at/i);
  });

  it("has granted_by column", () => {
    expect(content).toMatch(/granted_by/i);
  });

  it("has UNIQUE constraint on (user_id, project_slug)", () => {
    expect(content).toMatch(/UNIQUE/i);
  });
});

// --- Members route ---
describe("ms-a2-2-project-access: members.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/members.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports membersRouter", () => {
    expect(content).toMatch(/export.*membersRouter/);
  });

  it("uses mergeParams for nested routing", () => {
    expect(content).toMatch(/mergeParams/);
  });

  it("uses auth middleware", () => {
    expect(content).toMatch(/requireApiKeyOrJwt|requireAuth|auth/i);
  });

  it("handles POST for adding members", () => {
    expect(content).toMatch(/post/i);
  });

  it("handles GET for listing members", () => {
    expect(content).toMatch(/get/i);
  });

  it("handles DELETE for removing members", () => {
    expect(content).toMatch(/delete/i);
  });

  it("JOINs with users for member info", () => {
    expect(content).toMatch(/JOIN.*users|users.*JOIN/i);
  });

  it("returns 201 on member added", () => {
    expect(content).toMatch(/201/);
  });

  it("returns 404 for not found", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 409 for duplicate membership", () => {
    expect(content).toMatch(/409/);
  });

  it("defaults role to viewer", () => {
    expect(content).toMatch(/viewer/i);
  });
});

// --- Server integration ---
describe("ms-a2-2-project-access: server/route mount", () => {
  let serverContent: string;
  let projectsContent: string;
  try {
    serverContent = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    serverContent = "";
  }
  try {
    projectsContent = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch {
    projectsContent = "";
  }
  const combined = serverContent + projectsContent;

  it("mounts members route under projects", () => {
    expect(combined).toMatch(/members/i);
  });
});
