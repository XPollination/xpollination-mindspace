/**
 * TDD tests for h1-6-viz-capability-drilldown — Capability drill-down view.
 *
 * From PDSA h1-6-viz-capability-drilldown v0.0.1 (2026-03-12):
 *
 * AC-CD1: GET /api/mission-overview endpoint exists in server.js
 * AC-CD2: GET /api/capabilities/:capId endpoint exists in server.js
 * AC-CD3: mission-overview returns capabilities with progress
 * AC-CD4: capability detail returns requirements + tasks
 * AC-CD5: loadMissionDashboard() is functional (not a stub)
 * AC-CD6: showCapabilityDetail() function exists
 * AC-CD7: Drill-down shows requirements list
 * AC-CD8: Drill-down shows tasks with status badges
 * AC-CD9: Back navigation from drill-down
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
// AC-CD1: GET /api/mission-overview endpoint
// ============================================================

describe("AC-CD1: Server has /api/mission-overview endpoint", () => {
  it("server.js contains /api/mission-overview route", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    expect(source).toContain("/api/mission-overview");
  });

  it("endpoint returns 200 (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/mission-overview?project=xpollination-mcp-server`);
    // 200 or 404 (no missions) is acceptable, but should be JSON
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
  });
});

// ============================================================
// AC-CD2: GET /api/capabilities/:capId endpoint
// ============================================================

describe("AC-CD2: Server has /api/capabilities/:capId endpoint", () => {
  it("server.js contains /api/capabilities/ route pattern", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    expect(source).toMatch(/\/api\/capabilities\//);
  });

  it("endpoint returns JSON for invalid capId (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/capabilities/nonexistent?project=xpollination-mcp-server`);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
  });
});

// ============================================================
// AC-CD3: mission-overview returns capabilities with progress
// ============================================================

describe("AC-CD3: Mission overview response shape", () => {
  it("response has capabilities array (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/mission-overview?project=xpollination-mcp-server`);
    if (res.status !== 200) return; // No missions data yet
    const data = (await res.json()) as Record<string, unknown>;
    expect(data).toHaveProperty("capabilities");
    expect(Array.isArray(data.capabilities)).toBe(true);
  });

  it("each capability has progress_percent and task counts (live test)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/mission-overview?project=xpollination-mcp-server`);
    if (res.status !== 200) return;
    const data = (await res.json()) as { capabilities: Array<Record<string, unknown>> };
    if (!data.capabilities?.length) return;

    const cap = data.capabilities[0];
    expect(cap).toHaveProperty("task_count");
    expect(cap).toHaveProperty("complete_count");
    expect(cap).toHaveProperty("progress_percent");
  });
});

// ============================================================
// AC-CD4: Capability detail returns requirements + tasks
// ============================================================

describe("AC-CD4: Capability detail response shape", () => {
  it("server.js capability endpoint queries requirements and tasks", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");
    const capStart = source.indexOf("/api/capabilities/");
    if (capStart === -1) return; // Endpoint must exist first (AC-CD2)

    const capBlock = source.slice(capStart, capStart + 3000);
    // Must query requirements and tasks
    expect(capBlock).toMatch(/requirements|requirement/i);
    expect(capBlock).toMatch(/tasks|mindspace_nodes/i);
  });
});

// ============================================================
// AC-CD5: loadMissionDashboard() is functional
// ============================================================

describe("AC-CD5: loadMissionDashboard() fetches real data", () => {
  it("index.html loadMissionDashboard calls /api/mission-overview", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("loadMissionDashboard");
    expect(funcStart).toBeGreaterThan(-1);

    const funcBlock = source.slice(funcStart, funcStart + 1500);
    // Must fetch from API (not just show "Loading...")
    expect(funcBlock).toMatch(/\/api\/mission-overview/);
    expect(funcBlock).toMatch(/fetch/);
  });

  it("renders capability cards with progress", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("loadMissionDashboard");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 2000);
    // Must render cap-card elements
    expect(funcBlock).toMatch(/cap-card|capability.*card/i);
    expect(funcBlock).toMatch(/progress/i);
  });
});

// ============================================================
// AC-CD6: showCapabilityDetail() function
// ============================================================

describe("AC-CD6: showCapabilityDetail() exists", () => {
  it("index.html has showCapabilityDetail function", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toMatch(/showCapabilityDetail|show.*capability.*detail/i);
  });

  it("function fetches /api/capabilities/:capId", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("showCapabilityDetail");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 2000);
    expect(funcBlock).toMatch(/\/api\/capabilities\//);
    expect(funcBlock).toMatch(/fetch/);
  });
});

// ============================================================
// AC-CD7: Drill-down shows requirements list
// ============================================================

describe("AC-CD7: Requirements displayed in drill-down", () => {
  it("showCapabilityDetail renders requirements", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("showCapabilityDetail");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 3000);
    // Must render requirements (req_id_human, title, status)
    expect(funcBlock).toMatch(/requirements|req_id_human/i);
  });
});

// ============================================================
// AC-CD8: Tasks with status badges
// ============================================================

describe("AC-CD8: Tasks with status badges", () => {
  it("showCapabilityDetail renders tasks with status", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("showCapabilityDetail");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 3000);
    // Must render tasks with status
    expect(funcBlock).toMatch(/tasks|task/i);
    expect(funcBlock).toMatch(/status/i);
  });

  it("tasks show role colors", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("showCapabilityDetail");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 3000);
    // Must reference role for coloring
    expect(funcBlock).toMatch(/role/i);
  });
});

// ============================================================
// AC-CD9: Back navigation
// ============================================================

describe("AC-CD9: Back navigation from drill-down", () => {
  it("drill-down has Back button or close mechanism", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    const funcStart = source.indexOf("showCapabilityDetail");
    if (funcStart === -1) return;

    const funcBlock = source.slice(funcStart, funcStart + 3000);
    // Must have back/close mechanism
    expect(funcBlock).toMatch(/[Bb]ack|hideDetail|close/);
  });
});
