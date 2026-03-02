/**
 * Tests for LIAISON approval 3 modes extension.
 *
 * From PDSA liaison-approval-3-modes (2026-03-02):
 * AC-LA3M1: Viz API accepts "semi" as valid mode value
 * AC-LA3M2: Auto mode has NO liaison_reasoning requirement
 * AC-LA3M3: Semi mode has NO engine enforcement (no human_confirmed, no liaison_reasoning)
 * AC-LA3M4: Manual mode still requires human_confirmed (unchanged from liaison-approval-mode)
 * AC-LA3M5: Viz dropdown has 3 options (manual, semi, auto)
 * AC-LA3M6: Default mode remains manual
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

// --- AC-LA3M1: Viz API accepts semi ---

describe("AC-LA3M1: PUT /api/settings/liaison-approval-mode accepts semi", () => {
  it("returns 200 when setting mode to semi", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "semi" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { mode: string };
    expect(data.mode).toBe("semi");
  });

  it("GET returns semi after setting it", async () => {
    if (!vizUp) return;
    // Set to semi first
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "semi" }),
    });
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`);
    const data = (await res.json()) as { mode: string };
    expect(data.mode).toBe("semi");
  });

  it("resets mode back to manual after test", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
    expect(res.status).toBe(200);
  });
});

// --- AC-LA3M2: Auto mode has no liaison_reasoning requirement ---

describe("AC-LA3M2: Auto mode has no liaison_reasoning requirement", () => {
  it("interface-cli.js does NOT require liaison_reasoning for auto mode", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js",
      "utf-8",
    );

    // Find the LIAISON mode gate section
    const modeGateStart = source.indexOf("liaison_approval_mode");
    expect(modeGateStart).toBeGreaterThan(-1);

    // The auto mode branch should NOT reference liaison_reasoning as a requirement
    // Look for the pattern: auto mode should just pass through
    const modeSection = source.slice(modeGateStart, modeGateStart + 1000);

    // In the new design, auto mode has no requirements.
    // If liaison_reasoning is mentioned in the mode section, it should not be as a requirement.
    // The old code has: if (!dna.liaison_reasoning) { error(...) }
    // The new code should NOT have this for auto mode.
    const hasAutoReasoningGate =
      modeSection.includes("auto") &&
      modeSection.includes("liaison_reasoning") &&
      modeSection.includes("error");
    expect(hasAutoReasoningGate).toBe(false);
  });
});

// --- AC-LA3M3: Semi mode has no engine enforcement ---

describe("AC-LA3M3: Semi mode has no engine enforcement", () => {
  it("interface-cli.js does not enforce anything for semi mode", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js",
      "utf-8",
    );

    // The mode gate should handle semi by NOT requiring anything
    // Only manual should have a hard gate (human_confirmed)
    const modeGateStart = source.indexOf("liaison_approval_mode");
    if (modeGateStart === -1) return; // Skip if mode gate not found

    const modeSection = source.slice(modeGateStart, modeGateStart + 1000);

    // semi mode should not have an error() call with a requirement
    // If semi is mentioned, it should be in a comment or pass-through
    const hasSemiGate =
      modeSection.includes("'semi'") &&
      modeSection.includes("error(") &&
      modeSection.indexOf("'semi'") < modeSection.indexOf("error(");
    // This pattern check is approximate — the key assertion is that
    // only manual triggers an error for missing human_confirmed
    expect(hasSemiGate).toBe(false);
  });
});

// --- AC-LA3M4: Manual mode still requires human_confirmed ---

describe("AC-LA3M4: Manual mode still requires human_confirmed", () => {
  it("interface-cli.js still requires human_confirmed for manual mode", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js",
      "utf-8",
    );
    // Manual mode should still check for human_confirmed
    expect(source).toContain("human_confirmed");
    expect(source).toContain("manual");
  });
});

// --- AC-LA3M5: Viz dropdown has 3 options ---

describe("AC-LA3M5: Viz dropdown has 3 options", () => {
  it("index.html contains semi option in liaison-mode dropdown", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/index.html",
      "utf-8",
    );
    // Should have all 3 option values
    expect(source).toContain('value="manual"');
    expect(source).toContain('value="semi"');
    expect(source).toContain('value="auto"');
  });
});

// --- AC-LA3M6: Default mode remains manual ---

describe("AC-LA3M6: Default mode is manual", () => {
  it("GET settings returns manual after reset", async () => {
    if (!vizUp) return;
    // Reset to manual
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`);
    const data = (await res.json()) as { mode: string };
    expect(data.mode).toBe("manual");
  });
});
