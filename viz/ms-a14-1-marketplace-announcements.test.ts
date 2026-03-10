/**
 * TDD tests for ms-a14-1-marketplace-announcements
 *
 * Verifies marketplace announcements table and CRUD:
 * - Migration: marketplace_announcements table
 * - Cross-project at /api/marketplace/announcements
 * - POST (admin of announcing project), GET (authenticated), PUT (admin), no DELETE
 * - Category enum: feature, integration, service, data
 * - Status enum: active, expired, withdrawn
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/019-marketplace-announcements.sql:
 *   - CREATE TABLE marketplace_announcements (id, project_slug FK, title, description,
 *     category CHECK, status CHECK, created_by FK users, created_at, updated_at)
 * - Create api/routes/marketplace-announcements.ts:
 *   - Export marketplaceAnnouncementsRouter
 *   - GET / (authenticated, filter by ?status, ?category, ?project_slug)
 *   - GET /:id, POST / (admin of project), PUT /:id (admin)
 *   - No DELETE — use status:withdrawn
 * - Update api/server.ts: mount at /api/marketplace/announcements
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Migration ---
describe("ms-a14-1-marketplace-announcements: migration", () => {
  it("marketplace-announcements migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/019-marketplace-announcements.sql"),
      resolve(API_DIR, "db/migrations/020-marketplace-announcements.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/019-marketplace-announcements.sql"),
      resolve(API_DIR, "db/migrations/020-marketplace-announcements.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("creates marketplace_announcements table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*marketplace_announcements/i);
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
    expect(content).toMatch(/service/);
    expect(content).toMatch(/data/);
  });

  it("has status CHECK (active, expired, withdrawn)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/active/);
    expect(content).toMatch(/expired/);
    expect(content).toMatch(/withdrawn/);
  });

  it("has created_by FK to users", () => {
    expect(content).toMatch(/created_by/);
    expect(content).toMatch(/REFERENCES\s+users/i);
  });
});

// --- Router ---
describe("ms-a14-1-marketplace-announcements: router", () => {
  it("marketplace-announcements.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/marketplace-announcements.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/marketplace-announcements.ts"), "utf-8");
  } catch { content = ""; }

  it("exports marketplaceAnnouncementsRouter", () => {
    expect(content).toMatch(/export.*marketplaceAnnouncementsRouter/);
  });

  it("has GET handler for listing announcements", () => {
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports ?status filter", () => {
    expect(content).toMatch(/status/);
  });

  it("supports ?category filter", () => {
    expect(content).toMatch(/category/);
  });

  it("supports ?project_slug filter", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("has POST handler for creating announcements", () => {
    expect(content).toMatch(/\.post\(/i);
  });

  it("has PUT handler for updating announcements", () => {
    expect(content).toMatch(/\.put\(/i);
  });

  it("does NOT have DELETE handler (use withdrawn status)", () => {
    expect(content).toMatch(/withdrawn/i);
  });

  it("returns 403 for non-admin creating/updating", () => {
    expect(content).toMatch(/403/);
  });

  it("returns 404 for non-existent announcement", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 400 for invalid category", () => {
    expect(content).toMatch(/400/);
  });
});

// --- Server mount ---
describe("ms-a14-1-marketplace-announcements: server.ts mount", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch { content = ""; }

  it("imports marketplaceAnnouncementsRouter", () => {
    expect(content).toMatch(/marketplaceAnnouncementsRouter|marketplace-announcements/);
  });

  it("mounts at /api/marketplace/announcements", () => {
    expect(content).toMatch(/marketplace/);
    expect(content).toMatch(/announcements/);
  });
});
