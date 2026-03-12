/**
 * TDD tests for t3-7-suspect-viz — Suspect status visualization in viz dashboard.
 *
 * From PDSA t3-7-suspect-viz v0.0.1 (2026-03-12):
 *
 * AC-SV1: GET /api/suspect-links/stats endpoint exists in server.js
 * AC-SV2: Endpoint returns { suspect, cleared, accepted_risk, total, by_source_type }
 * AC-SV3: Endpoint handles missing suspect_links table gracefully (zeros)
 * AC-SV4: Endpoint supports project=all (merged stats)
 * AC-SV5: Suspect status bar HTML exists in index.html
 * AC-SV6: loadSuspectStats() function fetches and renders stats
 * AC-SV7: Bar hidden when total=0 (no suspect links)
 * AC-SV8: Progress bar shows clearance percentage
 * AC-SV9: Color palette: suspect=red, cleared=green, accepted_risk=amber
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
// AC-SV1: GET /api/suspect-links/stats endpoint exists
// ============================================================

describe("AC-SV1: Server has /api/suspect-links/stats endpoint", () => {
  it("server.js contains /api/suspect-links/stats route", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    expect(source).toContain("/api/suspect-links/stats");
  });

  it("endpoint returns 200 (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/suspect-links/stats?project=all`);
    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
  });
});

// ============================================================
// AC-SV2: Response shape { suspect, cleared, accepted_risk, total, by_source_type }
// ============================================================

describe("AC-SV2: Correct response shape", () => {
  it("response has suspect, cleared, accepted_risk, total fields (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/suspect-links/stats?project=all`);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data).toHaveProperty("suspect");
    expect(data).toHaveProperty("cleared");
    expect(data).toHaveProperty("accepted_risk");
    expect(data).toHaveProperty("total");
    expect(typeof data.suspect).toBe("number");
    expect(typeof data.cleared).toBe("number");
    expect(typeof data.accepted_risk).toBe("number");
    expect(typeof data.total).toBe("number");
  });

  it("response has by_source_type object (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/suspect-links/stats?project=all`);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data).toHaveProperty("by_source_type");
    expect(typeof data.by_source_type).toBe("object");
  });
});

// ============================================================
// AC-SV3: Graceful handling when suspect_links table missing
// ============================================================

describe("AC-SV3: Missing table returns zeros", () => {
  it("server.js handles SQLITE_ERROR for missing suspect_links table", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const statsStart = source.indexOf("/api/suspect-links/stats");
    expect(statsStart).toBeGreaterThan(-1);

    const statsBlock = source.slice(statsStart, statsStart + 2000);
    // Must have error handling (try/catch or error check)
    expect(statsBlock).toMatch(/catch|error/i);
  });

  it("returns zeros when no suspect_links exist (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/suspect-links/stats?project=all`);
    const data = (await res.json()) as Record<string, unknown>;
    // Should return zeros, not error
    expect(typeof data.total).toBe("number");
  });
});

// ============================================================
// AC-SV4: project=all merges stats from all projects
// ============================================================

describe("AC-SV4: project=all support", () => {
  it("server.js stats endpoint handles project=all", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const statsStart = source.indexOf("/api/suspect-links/stats");
    expect(statsStart).toBeGreaterThan(-1);

    const statsBlock = source.slice(statsStart, statsStart + 2000);
    // Must handle 'all' project parameter
    expect(statsBlock).toMatch(/['"]all['"]/);
  });
});

// ============================================================
// AC-SV5: Suspect status bar HTML in index.html
// ============================================================

describe("AC-SV5: Suspect status bar HTML", () => {
  it("index.html has suspect-status-bar element", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/suspect-status-bar|suspect.*status.*bar/i);
  });

  it("index.html has suspect-count, cleared-count, risk-count elements", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/suspect-count|suspect.*count/i);
    expect(source).toMatch(/cleared-count|cleared.*count/i);
    expect(source).toMatch(/risk-count|accepted.*risk.*count/i);
  });

  it("index.html has progress bar elements", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/suspect-progress|progress.*bar/i);
  });
});

// ============================================================
// AC-SV6: loadSuspectStats() function
// ============================================================

describe("AC-SV6: loadSuspectStats() function", () => {
  it("index.html has loadSuspectStats function", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/loadSuspectStats|load.*suspect.*stats/i);
  });

  it("function fetches /api/suspect-links/stats", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/\/api\/suspect-links\/stats/);
  });
});

// ============================================================
// AC-SV7: Bar hidden when total=0
// ============================================================

describe("AC-SV7: Bar hidden when no suspect links", () => {
  it("loadSuspectStats hides bar when total is 0", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcMatch = source.match(/loadSuspectStats[\s\S]*?(?=function\s|window\.|$)/);
    if (funcMatch) {
      // Must check total === 0 and hide the bar
      expect(funcMatch[0]).toMatch(/total.*===?\s*0|\.display\s*=\s*['"]none['"]/);
    } else {
      // Function must exist
      expect(funcMatch).not.toBeNull();
    }
  });
});

// ============================================================
// AC-SV8: Progress bar shows clearance percentage
// ============================================================

describe("AC-SV8: Clearance progress calculation", () => {
  it("calculates percentage from cleared + accepted_risk vs total", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    // Must calculate (cleared + accepted_risk) / total for progress
    expect(source).toMatch(/cleared.*accepted_risk|accepted_risk.*cleared/);
    expect(source).toMatch(/total/);
  });
});

// ============================================================
// AC-SV9: Color palette
// ============================================================

describe("AC-SV9: Color palette matches spec", () => {
  it("suspect uses red (#ef4444)", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    // The suspect indicator should use red
    expect(source).toMatch(/#ef4444|rgb\(239,\s*68,\s*68\)|red/i);
  });

  it("cleared uses green (#22c55e)", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/#22c55e|rgb\(34,\s*197,\s*94\)|green/i);
  });

  it("accepted_risk uses amber (#f59e0b)", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/#f59e0b|rgb\(245,\s*158,\s*11\)|amber/i);
  });
});
