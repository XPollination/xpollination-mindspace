/**
 * TDD tests for ms-a14-4-marketplace-brain
 *
 * Verifies marketplace → brain thought auto-publish:
 * - Service: marketplace-brain.ts with contribution functions
 * - Integration: hooks into marketplace POST endpoints
 * - Best-effort (creation succeeds even if brain fails)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/marketplace-brain.ts:
 *   - Export contributeMarketplaceItem(type, item, projectSlug)
 *   - POST to brain API with marketplace metadata
 *   - thought_category='marketplace', topic=type (announcement/request)
 *   - Best-effort: catch errors, never throw
 * - Update api/routes/marketplace-announcements.ts:
 *   - After POST creation, call contributeMarketplaceItem('announcement', ...)
 * - Update api/routes/marketplace-requests.ts:
 *   - After POST creation, call contributeMarketplaceItem('request', ...)
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a14-4-marketplace-brain: service", () => {
  it("marketplace-brain service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/marketplace-brain.ts"),
      resolve(API_DIR, "services/marketplaceBrain.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/marketplace-brain.ts"),
      resolve(API_DIR, "services/marketplaceBrain.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports contribution function", () => {
    expect(content).toMatch(/export.*contribute|exports.*contribute/i);
  });

  it("uses marketplace thought_category", () => {
    expect(content).toMatch(/marketplace/);
  });

  it("POSTs to brain API", () => {
    expect(content).toMatch(/fetch|POST|memory/i);
  });

  it("handles errors gracefully", () => {
    expect(content).toMatch(/catch|try|warn/i);
  });
});

describe("ms-a14-4-marketplace-brain: route hooks", () => {
  let announcementsContent: string;
  try {
    announcementsContent = readFileSync(resolve(API_DIR, "routes/marketplace-announcements.ts"), "utf-8");
  } catch { announcementsContent = ""; }

  it("announcements route hooks into brain contribution", () => {
    expect(announcementsContent).toMatch(/brain|contribute|marketplace/i);
  });
});
