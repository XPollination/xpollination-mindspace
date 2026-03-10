/**
 * TDD tests for ms-a13-1-org-brain-collection
 *
 * Verifies organization brain collection creation endpoint:
 * - 009 migration: adds has_org_brain + org_brain_collection columns to projects
 * - POST /api/projects/:slug/brain/provision: creates Qdrant collection
 * - GET /api/projects/:slug/brain/status: brain status
 * - Uses @qdrant/js-client-rest for Qdrant API
 * - Collection name: brain_org_{slug}
 * - 384-dim Cosine vectors (all-MiniLM-L6-v2)
 * - Idempotent provisioning
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/009-org-brain.sql:
 *   - ALTER TABLE projects ADD has_org_brain BOOLEAN DEFAULT FALSE
 *   - ALTER TABLE projects ADD org_brain_collection TEXT
 * - Create api/routes/brain.ts:
 *   - Export brainRouter
 *   - POST /provision: create Qdrant collection brain_org_{slug}
 *   - GET /status: check brain status
 *   - Uses @qdrant/js-client-rest QdrantClient
 *   - 384-dim vectors, Cosine distance
 *   - Update projects table (has_org_brain=true, org_brain_collection)
 *   - Idempotent: skip if collection already exists
 * - Update api/server.ts or projects.ts: mount brainRouter
 * - npm install @qdrant/js-client-rest
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a13-1-org-brain-collection: file structure", () => {
  it("009 migration file exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/009-org-brain.sql"))).toBe(true);
  });

  it("api/routes/brain.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/brain.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a13-1-org-brain-collection: 009-org-brain.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/009-org-brain.sql"), "utf-8");
  } catch { content = ""; }

  it("adds has_org_brain column to projects", () => {
    expect(content).toMatch(/has_org_brain/i);
  });

  it("adds org_brain_collection column", () => {
    expect(content).toMatch(/org_brain_collection/i);
  });

  it("modifies projects table", () => {
    expect(content).toMatch(/projects/i);
  });
});

// --- Brain route ---
describe("ms-a13-1-org-brain-collection: brain.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/brain.ts"), "utf-8");
  } catch { content = ""; }

  it("exports brainRouter", () => {
    expect(content).toMatch(/export.*brainRouter/);
  });

  it("handles POST /provision", () => {
    expect(content).toMatch(/provision/i);
    expect(content).toMatch(/post/i);
  });

  it("handles GET /status", () => {
    expect(content).toMatch(/status/i);
    expect(content).toMatch(/get/i);
  });

  it("imports or uses QdrantClient", () => {
    expect(content).toMatch(/qdrant|QdrantClient/i);
  });

  it("creates collection with brain_org_ prefix", () => {
    expect(content).toMatch(/brain_org_/);
  });

  it("uses 384-dim vectors", () => {
    expect(content).toMatch(/384/);
  });

  it("uses Cosine distance", () => {
    expect(content).toMatch(/[Cc]osine/);
  });

  it("updates has_org_brain in projects table", () => {
    expect(content).toMatch(/has_org_brain/);
  });

  it("is idempotent (handles existing collection)", () => {
    expect(content).toMatch(/exist|already|idempotent|skip/i);
  });

  it("returns 201 on provision", () => {
    expect(content).toMatch(/201/);
  });
});

// --- Dependencies ---
describe("ms-a13-1-org-brain-collection: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch { pkg = {}; }

  it("@qdrant/js-client-rest is in dependencies", () => {
    expect(
      pkg.dependencies?.["@qdrant/js-client-rest"] || pkg.dependencies?.["@qdrant/qdrant-js"]
    ).toBeDefined();
  });
});

// --- Server integration ---
describe("ms-a13-1-org-brain-collection: server/route mount", () => {
  let serverContent: string;
  let projectsContent: string;
  try { serverContent = readFileSync(resolve(API_DIR, "server.ts"), "utf-8"); } catch { serverContent = ""; }
  try { projectsContent = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8"); } catch { projectsContent = ""; }
  const combined = serverContent + projectsContent;

  it("mounts brain route", () => {
    expect(combined).toMatch(/brain/i);
  });
});
