/**
 * TDD tests for ms-a13-3-pichler-mindspace
 *
 * Verifies Pichler-Mindspace brain setup:
 * - Provisioning script exists
 * - Creates Qdrant collection
 * - Seeds Thomas + Maria users
 * - Idempotent
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create scripts/provision-pichler-mindspace.ts:
 *   - Creates Qdrant collection 'pichler-mindspace' via PUT to Qdrant API
 *   - Vector size 1536, Cosine distance
 *   - Verifies collection exists after creation
 *   - Verifies brain API health
 *   - Idempotent (safe to run multiple times)
 * - Create api/db/seed/pichler-mindspace-users.sql:
 *   - INSERT OR IGNORE Thomas (admin) and Maria (contributor)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

describe("ms-a13-3-pichler-mindspace: provisioning script", () => {
  it("provision script exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "scripts/provision-pichler-mindspace.ts"),
      resolve(PROJECT_ROOT, "scripts/provision-pichler-mindspace.js"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "scripts/provision-pichler-mindspace.ts"),
      resolve(PROJECT_ROOT, "scripts/provision-pichler-mindspace.js"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates pichler-mindspace collection", () => {
    expect(content).toMatch(/pichler-mindspace/);
  });

  it("uses Qdrant API for collection creation", () => {
    expect(content).toMatch(/qdrant|6333|collections/i);
  });

  it("specifies vector size 1536", () => {
    expect(content).toMatch(/1536/);
  });

  it("verifies brain API health", () => {
    expect(content).toMatch(/health/);
  });
});

describe("ms-a13-3-pichler-mindspace: seed data", () => {
  it("seed SQL file exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "api/db/seed/pichler-mindspace-users.sql"),
      resolve(PROJECT_ROOT, "api/db/seed/pichler-mindspace.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "api/db/seed/pichler-mindspace-users.sql"),
      resolve(PROJECT_ROOT, "api/db/seed/pichler-mindspace.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("seeds Thomas as admin", () => {
    expect(content).toMatch(/thomas/i);
    expect(content).toMatch(/admin/i);
  });

  it("seeds Maria as contributor", () => {
    expect(content).toMatch(/maria/i);
    expect(content).toMatch(/contributor/i);
  });

  it("uses INSERT OR IGNORE for idempotency", () => {
    expect(content).toMatch(/INSERT\s+OR\s+IGNORE/i);
  });
});
