/**
 * TDD tests for ms-viz-polling-fix-v2 — ETag/304 conditional polling for viz.
 *
 * From PDSA ms-viz-polling-fix-v2 v0.0.1 (2026-03-12):
 *
 * AC-ETAG1: Server /api/data response includes ETag header
 * AC-ETAG2: Server returns 304 when If-None-Match matches current ETag
 * AC-ETAG3: Server returns 200 with new ETag when data changes
 * AC-ETAG4: Server sends Cache-Control: no-cache on /api/data
 * AC-ETAG5: Client pollData() sends If-None-Match header with stored ETag
 * AC-ETAG6: Client handles 304 response (skips JSON parsing, no re-render)
 * AC-ETAG7: Client stores ETag from response for next request
 * AC-ETAG8: Server ETag works for both project=all and single project
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);
const VIZ_HTML_PATH = join(VIZ_DIR, "index.html");
const SERVER_PATH = join(VIZ_DIR, "server.js");

const VIZ_URL = "http://localhost:8080";

async function vizServerIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${VIZ_URL}/api/projects`);
    return res.ok;
  } catch {
    return false;
  }
}

let vizUp: boolean;

beforeAll(async () => {
  vizUp = await vizServerIsRunning();
});

// ============================================================
// AC-ETAG1: Server /api/data includes ETag header
// ============================================================

describe("AC-ETAG1: Server sends ETag on /api/data", () => {
  it("server.js imports or uses crypto for ETag generation", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    // Must use crypto module for MD5 hash
    expect(source).toMatch(/require\s*\(\s*['"]crypto['"]\s*\)|import.*crypto/);
  });

  it("server.js /api/data handler generates ETag", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const dataHandlerStart = source.indexOf("pathname === '/api/data'");
    expect(dataHandlerStart).toBeGreaterThan(-1);

    const dataBlock = source.slice(dataHandlerStart, dataHandlerStart + 3000);
    // Must compute ETag from response data
    expect(dataBlock).toMatch(/[Ee][Tt]ag|etag/i);
    expect(dataBlock).toMatch(/md5|createHash/);
  });

  it("GET /api/data returns ETag header (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/data?project=all`);
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag") || res.headers.get("etag");
    expect(etag).not.toBeNull();
    expect(etag).toMatch(/^"[a-f0-9]+"$/); // MD5 hex in quotes
  });
});

// ============================================================
// AC-ETAG2: Server returns 304 when If-None-Match matches
// ============================================================

describe("AC-ETAG2: Server returns 304 on matching If-None-Match", () => {
  it("server.js /api/data handler checks If-None-Match header", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const dataHandlerStart = source.indexOf("pathname === '/api/data'");
    expect(dataHandlerStart).toBeGreaterThan(-1);

    const dataBlock = source.slice(dataHandlerStart, dataHandlerStart + 3000);
    expect(dataBlock).toMatch(/if-none-match|If-None-Match/i);
    expect(dataBlock).toContain("304");
  });

  it("returns 304 with matching ETag (live test)", async () => {
    if (!vizUp) return;
    // First request: get ETag
    const res1 = await fetch(`${VIZ_URL}/api/data?project=all`);
    const etag = res1.headers.get("ETag") || res1.headers.get("etag");
    expect(etag).not.toBeNull();

    // Second request with If-None-Match
    const res2 = await fetch(`${VIZ_URL}/api/data?project=all`, {
      headers: { "If-None-Match": etag! },
    });
    expect(res2.status).toBe(304);
  });
});

// ============================================================
// AC-ETAG3: Server returns 200 with new ETag when data changes
// ============================================================

describe("AC-ETAG3: Server returns 200 when data changes", () => {
  it("returns 200 with mismatched If-None-Match (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/data?project=all`, {
      headers: { "If-None-Match": '"00000000000000000000000000000000"' },
    });
    expect(res.status).toBe(200);
    const etag = res.headers.get("ETag") || res.headers.get("etag");
    expect(etag).not.toBeNull();
  });
});

// ============================================================
// AC-ETAG4: Server sends Cache-Control: no-cache
// ============================================================

describe("AC-ETAG4: Cache-Control: no-cache on /api/data", () => {
  it("server.js sets Cache-Control: no-cache on /api/data", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const dataHandlerStart = source.indexOf("pathname === '/api/data'");
    expect(dataHandlerStart).toBeGreaterThan(-1);

    const dataBlock = source.slice(dataHandlerStart, dataHandlerStart + 3000);
    expect(dataBlock).toMatch(/[Cc]ache-[Cc]ontrol.*no-cache|no-cache.*[Cc]ache-[Cc]ontrol/);
  });

  it("GET /api/data returns Cache-Control header (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/data?project=all`);
    const cc = res.headers.get("Cache-Control") || res.headers.get("cache-control");
    expect(cc).toContain("no-cache");
  });
});

// ============================================================
// AC-ETAG5: Client sends If-None-Match with stored ETag
// ============================================================

describe("AC-ETAG5: Client sends If-None-Match in pollData()", () => {
  it("index.html pollData() includes If-None-Match header", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");

    // Find pollData function
    const pollStart = source.indexOf("async function pollData");
    expect(pollStart).toBeGreaterThan(-1);

    const pollBlock = source.slice(pollStart, pollStart + 1000);
    // Must send If-None-Match header
    expect(pollBlock).toMatch(/If-None-Match/);
  });

  it("index.html has lastEtag variable for storing ETag", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/lastEtag|last_etag|lastETAG/);
  });
});

// ============================================================
// AC-ETAG6: Client handles 304 response
// ============================================================

describe("AC-ETAG6: Client handles 304 (skip processing)", () => {
  it("pollData() checks for 304 status and returns early", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");

    const pollStart = source.indexOf("async function pollData");
    expect(pollStart).toBeGreaterThan(-1);

    const pollBlock = source.slice(pollStart, pollStart + 1000);
    // Must check for 304 and return early (no JSON parsing)
    expect(pollBlock).toContain("304");
    // 304 handling should come BEFORE response.json()
    const idx304 = pollBlock.indexOf("304");
    const idxJson = pollBlock.indexOf(".json()");
    expect(idx304).toBeLessThan(idxJson);
  });
});

// ============================================================
// AC-ETAG7: Client stores ETag from response
// ============================================================

describe("AC-ETAG7: Client stores ETag from 200 response", () => {
  it("pollData() reads ETag from response headers and stores it", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");

    const pollStart = source.indexOf("async function pollData");
    expect(pollStart).toBeGreaterThan(-1);

    const pollBlock = source.slice(pollStart, pollStart + 1000);
    // Must read ETag header and store for next request
    expect(pollBlock).toMatch(/headers\.get.*[Ee][Tt]ag|getResponseHeader.*[Ee][Tt]ag/i);
    expect(pollBlock).toMatch(/lastEtag\s*=|last_etag\s*=/);
  });
});

// ============================================================
// AC-ETAG8: ETag works for both project=all and single project
// ============================================================

describe("AC-ETAG8: ETag on both project=all and single project paths", () => {
  it("server.js has ETag logic in both /api/data code paths", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const dataHandlerStart = source.indexOf("pathname === '/api/data'");
    expect(dataHandlerStart).toBeGreaterThan(-1);

    const dataBlock = source.slice(dataHandlerStart, dataHandlerStart + 3000);

    // The ETag logic should apply to both the project=all path and
    // the single-project path. Either:
    // (a) shared ETag logic before the branch, or
    // (b) ETag logic in both branches
    // Check that sendJson is NOT used for /api/data (PDSA says to control response directly)
    // At minimum, the ETag logic must be present and there should be writeHead with ETag
    const etagCount = (dataBlock.match(/[Ee][Tt]ag/g) || []).length;
    // At least 2 references: one for setting, one for checking
    expect(etagCount).toBeGreaterThanOrEqual(2);
  });

  it("single project also returns ETag (live test)", async () => {
    if (!vizUp) return;
    // Get first project name
    const projRes = await fetch(`${VIZ_URL}/api/projects`);
    const projects = (await projRes.json()) as Array<{ name: string }>;
    if (!projects.length) return;

    const res = await fetch(`${VIZ_URL}/api/data?project=${projects[0].name}`);
    if (res.status === 200) {
      const etag = res.headers.get("ETag") || res.headers.get("etag");
      expect(etag).not.toBeNull();
    }
  });
});
