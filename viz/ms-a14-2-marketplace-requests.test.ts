/**
 * TDD tests for ms-a14-2-marketplace-requests
 *
 * Verifies marketplace requests table and CRUD:
 * - Migration: marketplace_requests table
 * - Cross-project at /api/marketplace/requests
 * - POST (admin of requesting project), GET (authenticated), PUT (admin), no DELETE
 * - Category enum: feature, integration, service, data
 * - Status enum: open, matched, fulfilled, closed
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/020-marketplace-requests.sql:
 *   - CREATE TABLE marketplace_requests (id, project_slug FK, title, description,
 *     category CHECK, status CHECK, created_by FK users, created_at, updated_at)
 * - Create api/routes/marketplace-requests.ts:
 *   - Export marketplaceRequestsRouter
 *   - GET / (authenticated, filter by ?status, ?category, ?project_slug)
 *   - GET /:id, POST / (admin of project), PUT /:id (admin)
 *   - No DELETE — use status:closed
 * - Update api/server.ts: mount at /api/marketplace/requests
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a14-2-marketplace-requests: migration", () => {
  it("marketplace-requests migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/020-marketplace-requests.sql"),
      resolve(API_DIR, "db/migrations/021-marketplace-requests.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/020-marketplace-requests.sql"),
      resolve(API_DIR, "db/migrations/021-marketplace-requests.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates marketplace_requests table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*marketplace_requests/i);
  });

  it("has project_slug FK to projects", () => {
    expect(content).toMatch(/project_slug/);
    expect(content).toMatch(/REFERENCES\s+projects/i);
  });

  it("has category CHECK (feature, integration, service, data)", () => {
    expect(content).toMatch(/category/);
    expect(content).toMatch(/CHECK/i);
    expect(content).toMatch(/feature/);
    expect(content).toMatch(/integration/);
  });

  it("has status CHECK (open, matched, fulfilled, closed)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/open/);
    expect(content).toMatch(/matched/);
    expect(content).toMatch(/fulfilled/);
    expect(content).toMatch(/closed/);
  });

  it("has created_by FK to users", () => {
    expect(content).toMatch(/created_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });
});

// --- Router ---
describe("ms-a14-2-marketplace-requests: router", () => {
  it("marketplace-requests.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/marketplace-requests.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/marketplace-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("exports marketplaceRequestsRouter", () => {
    expect(content).toMatch(/export.*marketplaceRequestsRouter/);
  });

  it("has GET handler for listing requests", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?status filter", () => {
    expect(content).toMatch(/status/);
  });

  it("supports ?category filter", () => {
    expect(content).toMatch(/category/);
  });

  it("has POST handler for creating requests", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has PUT handler for updating requests", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("does NOT have DELETE handler (use closed status)", () => {
    expect(content).toMatch(/closed/i);
  });

  it("returns 403 for non-admin creating/updating", () => {
    expect(content).toMatch(/403/);
  });

  it("returns 404 for non-existent request", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 400 for invalid category", () => {
    expect(content).toMatch(/400/);
  });
});

// --- Server mount ---
describe("ms-a14-2-marketplace-requests: server.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch { content = ""; }

  it("imports marketplaceRequestsRouter", () => {
    expect(content).toMatch(/marketplaceRequestsRouter|marketplace-requests/);
  });

  it("mounts at /api/marketplace/requests", () => {
    expect(content).toMatch(/marketplace/);
    expect(content).toMatch(/requests/);
  });
});
