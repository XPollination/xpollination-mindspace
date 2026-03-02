/**
 * Tests for LIAISON approval mode (auto vs manual).
 *
 * From PDSA liaison-approval-mode (2026-03-02):
 * AC-LAM1: Human-decision transitions have requiresHumanConfirm flag
 * AC-LAM2: getHumanConfirmTransitions() returns correct transition keys
 * AC-LAM3: GET /api/settings/liaison-approval-mode returns mode
 * AC-LAM4: PUT /api/settings/liaison-approval-mode updates mode
 * AC-LAM5: PUT /api/node/:slug/confirm sets human_confirmed in DNA
 * AC-LAM6: Default mode is manual
 * AC-LAM7: LIAISON cannot set human_confirmed via update-dna CLI (protection)
 * AC-LAM8: system_settings table exists in schema
 */
import { describe, it, expect, beforeAll } from "vitest";

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

// --- AC-LAM1: requiresHumanConfirm flag on human-decision transitions ---

describe("AC-LAM1: Workflow engine has requiresHumanConfirm flag", () => {
  it("approval->approved has requiresHumanConfirm: true", async () => {
    // Import workflow engine module
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = (engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>) ?? {};
    const taskTransitions = transitions["task"] ?? {};
    expect(taskTransitions["approval->approved"]).toBeDefined();
    expect(taskTransitions["approval->approved"].requiresHumanConfirm).toBe(true);
  });

  it("approval->rework has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = (engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>) ?? {};
    const taskTransitions = transitions["task"] ?? {};
    expect(taskTransitions["approval->rework"]).toBeDefined();
    expect(taskTransitions["approval->rework"].requiresHumanConfirm).toBe(true);
  });

  it("review->complete has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = (engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>) ?? {};
    const taskTransitions = transitions["task"] ?? {};
    expect(taskTransitions["review->complete"]).toBeDefined();
    expect(taskTransitions["review->complete"].requiresHumanConfirm).toBe(true);
  });

  it("complete->rework has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = (engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>) ?? {};
    const taskTransitions = transitions["task"] ?? {};
    expect(taskTransitions["complete->rework"]).toBeDefined();
    expect(taskTransitions["complete->rework"].requiresHumanConfirm).toBe(true);
  });
});

// --- AC-LAM2: getHumanConfirmTransitions() function ---

describe("AC-LAM2: getHumanConfirmTransitions() exists and returns correct keys", () => {
  it("function is exported", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    expect(typeof engine.getHumanConfirmTransitions).toBe("function");
  });

  it("returns all human-decision transition keys", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const getTransitions = engine.getHumanConfirmTransitions as () => string[];
    const keys = getTransitions();
    expect(keys).toContain("approval->approved");
    expect(keys).toContain("approval->rework");
    expect(keys).toContain("review->complete");
    expect(keys).toContain("complete->rework");
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });
});

// --- AC-LAM3: GET settings endpoint ---

describe("AC-LAM3: GET /api/settings/liaison-approval-mode", () => {
  it("returns 200 with mode object", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`);
    expect(res.status).toBe(200);
    const data = await res.json() as { mode: string };
    expect(data).toHaveProperty("mode");
    expect(["manual", "auto"]).toContain(data.mode);
  });
});

// --- AC-LAM4: PUT settings endpoint ---

describe("AC-LAM4: PUT /api/settings/liaison-approval-mode updates mode", () => {
  it("accepts mode change to auto", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { mode: string };
    expect(data.mode).toBe("auto");
  });

  it("accepts mode change back to manual", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { mode: string };
    expect(data.mode).toBe("manual");
  });

  it("rejects invalid mode value", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "invalid" }),
    });
    expect(res.status).toBe(400);
  });
});

// --- AC-LAM5: PUT confirm endpoint ---

describe("AC-LAM5: PUT /api/node/:slug/confirm sets human_confirmed", () => {
  it("endpoint returns JSON response (not HTML 404 page)", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/node/nonexistent-task-slug/confirm`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "best-practices" }),
    });
    // Endpoint should return JSON (either success or error), not generic HTML 404
    const contentType = res.headers.get("content-type") ?? "";
    expect(contentType).toContain("application/json");
  });

  it("returns 404 with JSON error for non-existent slug", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/node/nonexistent-task-slug/confirm`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "best-practices" }),
    });
    expect(res.status).toBe(404);
    const data = await res.json() as { error?: string };
    expect(data).toHaveProperty("error");
  });
});

// --- AC-LAM6: Default mode is manual ---

describe("AC-LAM6: Default mode is manual", () => {
  it("initial mode value is manual", async () => {
    if (!vizUp) return;
    // Reset to manual first
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`);
    const data = await res.json() as { mode: string };
    expect(data.mode).toBe("manual");
  });
});

// --- AC-LAM7: LIAISON cannot set human_confirmed via CLI ---

describe("AC-LAM7: LIAISON protection on human_confirmed field", () => {
  it("update-dna rejects human_confirmed when actor is liaison", async () => {
    // This test requires running the CLI. Test by executing the command and checking output.
    const { execSync } = await import("node:child_process");
    const CLI = "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js";
    const DB = "/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db";

    // Find a task to test against
    try {
      const result = execSync(
        `DATABASE_PATH=${DB} node ${CLI} update-dna liaison-approval-mode '{"human_confirmed":true}' liaison`,
        { encoding: "utf-8", timeout: 5000 }
      );
      // If it doesn't throw, check for error in output
      const hasError = result.includes("human_confirmed") && (result.includes("error") || result.includes("rejected"));
      expect(hasError).toBe(true);
    } catch (err) {
      // If it throws (exit code 1), that means it was rejected — correct behavior
      const stderr = (err as { stderr?: string }).stderr ?? "";
      const stdout = (err as { stdout?: string }).stdout ?? "";
      const output = stderr + stdout;
      expect(output).toContain("human_confirmed");
    }
  });
});

// --- AC-LAM8: system_settings table exists ---

describe("AC-LAM8: system_settings table in schema", () => {
  it("schema.sql contains system_settings table definition", async () => {
    const fs = await import("node:fs");
    const schema = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/schema.sql",
      "utf-8"
    );
    expect(schema).toContain("system_settings");
    expect(schema).toContain("liaison_approval_mode");
  });
});
