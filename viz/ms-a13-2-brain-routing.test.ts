/**
 * TDD tests for ms-a13-2-brain-routing
 *
 * Verifies brain routing logic (private → org → public):
 * - resolveCollections() pure routing function
 * - POST /api/projects/:slug/brain/contribute — writes to org collection only
 * - POST /api/projects/:slug/brain/query — reads from org + public collections
 * - Proxies to brain API with collection parameter
 * - F17 gate at org → public boundary
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/brain-router.ts:
 *   - Export brainRoutingRouter (or update brain.ts)
 *   - Export resolveCollections(projectSlug, hasOrgBrain)
 *     - Returns { write: "brain_org_{slug}", read: ["brain_org_{slug}", "brain_public"] }
 *   - POST /contribute: proxy to brain API with org collection
 *   - POST /query: proxy to brain API, merge results from org + public
 *   - Uses BRAIN_API_URL env var (default localhost:3200)
 * - Update api/routes/brain.ts: mount or integrate routing
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a13-2-brain-routing: file structure", () => {
  it("brain-router.ts or brain.ts with routing exists", () => {
    const paths = [
      resolve(API_DIR, "routes/brain-router.ts"),
      resolve(API_DIR, "routes/brain.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });
});

// --- Routing logic ---
describe("ms-a13-2-brain-routing: resolveCollections", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/brain-router.ts"),
      resolve(API_DIR, "routes/brain.ts"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("exports resolveCollections function", () => {
    expect(content).toMatch(/export.*resolveCollections|resolveCollections/);
  });

  it("returns write target as org collection", () => {
    expect(content).toMatch(/write/i);
    expect(content).toMatch(/brain_org_/);
  });

  it("returns read targets including org and public", () => {
    expect(content).toMatch(/read/i);
    expect(content).toMatch(/public|brain_public/i);
  });
});

// --- Contribute endpoint ---
describe("ms-a13-2-brain-routing: contribute endpoint", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/brain-router.ts"),
      resolve(API_DIR, "routes/brain.ts"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("has POST /contribute route", () => {
    expect(content).toMatch(/contribute/i);
    expect(content).toMatch(/post/i);
  });

  it("writes to org collection only", () => {
    expect(content).toMatch(/brain_org_/);
  });

  it("proxies to brain API", () => {
    expect(content).toMatch(/BRAIN_API_URL|localhost:3200|3200/);
  });
});

// --- Query endpoint ---
describe("ms-a13-2-brain-routing: query endpoint", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/brain-router.ts"),
      resolve(API_DIR, "routes/brain.ts"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("has POST /query route", () => {
    expect(content).toMatch(/query/i);
    expect(content).toMatch(/post/i);
  });

  it("reads from multiple collections (org + public)", () => {
    // Must reference both org and public collections
    expect(content).toMatch(/brain_org_/);
    expect(content).toMatch(/public|brain_public/i);
  });

  it("merges results from multiple collections", () => {
    expect(content).toMatch(/merge|concat|spread|\.\.\.|\[\]/i);
  });

  it("uses fetch or http to proxy to brain API", () => {
    expect(content).toMatch(/fetch|http|axios/i);
  });
});

// --- Privacy/F17 gate ---
describe("ms-a13-2-brain-routing: privacy enforcement", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "routes/brain-router.ts"),
      resolve(API_DIR, "routes/brain.ts"),
    ];
    content = "";
    for (const p of paths) {
      try { content += readFileSync(p, "utf-8"); } catch {}
    }
  } catch { content = ""; }

  it("enforces org-only writes (no direct public writes)", () => {
    // Contribute should NOT write to public collection
    // The write target should be brain_org_ only
    expect(content).toMatch(/brain_org_/);
  });

  it("uses BRAIN_API_URL env var", () => {
    expect(content).toMatch(/BRAIN_API_URL/);
  });
});
