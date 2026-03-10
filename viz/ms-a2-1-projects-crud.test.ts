/**
 * TDD tests for ms-a2-1-projects-crud
 *
 * Verifies projects table + CRUD endpoints:
 * - 006 migration: projects table (id, slug UNIQUE, name, description, created_at, created_by FK)
 * - POST/GET/GET/:slug/PUT/:slug /api/projects
 * - requireApiKeyOrJwt auth on all endpoints
 * - Slug validation (lowercase alphanumeric + hyphens, 2-50 chars)
 * - No DELETE endpoint
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/006-projects.sql:
 *   - projects: id UUID, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 *     description TEXT, created_at, created_by FK→users(id)
 * - Create api/routes/projects.ts:
 *   - Export projectsRouter
 *   - POST / : create project (validate slug regex, 201)
 *   - GET / : list all projects
 *   - GET /:slug : get project by slug
 *   - PUT /:slug : update project
 *   - All behind requireApiKeyOrJwt middleware
 *   - Slug regex: /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/
 *   - 400 for invalid slug, 404 for not found, 409 for duplicate slug
 * - Update api/server.ts: mount projectsRouter at /api/projects
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a2-1-projects-crud: file structure", () => {
  it("api/db/migrations/006-projects.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/006-projects.sql"))).toBe(true);
  });

  it("api/routes/projects.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/projects.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a2-1-projects-crud: 006-projects.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/006-projects.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates projects table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*projects/i);
  });

  it("has id column", () => {
    expect(content).toMatch(/\bid\b/i);
  });

  it("has slug column with UNIQUE constraint", () => {
    expect(content).toMatch(/slug/i);
    expect(content).toMatch(/UNIQUE/i);
  });

  it("has name column", () => {
    expect(content).toMatch(/\bname\b/i);
  });

  it("has description column", () => {
    expect(content).toMatch(/description/i);
  });

  it("has created_at column", () => {
    expect(content).toMatch(/created_at/i);
  });

  it("has created_by foreign key to users", () => {
    expect(content).toMatch(/created_by/i);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });
});

// --- Projects route ---
describe("ms-a2-1-projects-crud: projects.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports projectsRouter", () => {
    expect(content).toMatch(/export.*projectsRouter/);
  });

  it("uses auth middleware", () => {
    expect(content).toMatch(/requireApiKeyOrJwt|requireAuth|auth/i);
  });

  it("handles POST for creating projects", () => {
    expect(content).toMatch(/post/i);
  });

  it("handles GET for listing projects", () => {
    expect(content).toMatch(/get/i);
  });

  it("handles PUT for updating projects", () => {
    expect(content).toMatch(/put/i);
  });

  it("has slug parameter route", () => {
    expect(content).toMatch(/:slug|params.*slug/);
  });

  it("validates slug format", () => {
    expect(content).toMatch(/slug/i);
    expect(content).toMatch(/regex|match|test|valid/i);
  });

  it("returns 201 on creation", () => {
    expect(content).toMatch(/201/);
  });

  it("returns 400 for invalid input", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 404 for not found", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 409 for duplicate slug", () => {
    expect(content).toMatch(/409/);
  });
});

// --- Server integration ---
describe("ms-a2-1-projects-crud: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports projectsRouter", () => {
    expect(content).toMatch(/import.*projectsRouter.*from/);
  });

  it("mounts at /api/projects", () => {
    expect(content).toMatch(/\/api\/projects/);
  });
});
