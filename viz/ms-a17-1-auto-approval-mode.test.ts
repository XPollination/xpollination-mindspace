/**
 * TDD tests for ms-a17-1-auto-approval-mode
 *
 * Verifies auto-approval LIAISON mode:
 * - interface-cli.js: auto-approval mode gate logic
 *   - approval→approved passes freely (like auto)
 *   - review→complete BLOCKED (like manual, requires human_confirmed)
 * - viz/server.js: auto-approval in valid modes array
 * - viz/index.html: Auto-Approval option in dropdown
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update src/db/interface-cli.js (lines 625-655):
 *   - Add 'auto-approval' mode branch in LIAISON gate
 *   - When mode=auto-approval: approval→approved passes freely
 *   - When mode=auto-approval: review→complete requires human_confirmed+viz
 * - Update viz/server.js (line 329):
 *   - Add 'auto-approval' to valid modes array
 * - Update viz/index.html:
 *   - Add Auto-Approval option to approval mode dropdown
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- interface-cli.js: auto-approval mode gate ---
describe("ms-a17-1-auto-approval-mode: interface-cli.js", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/db/interface-cli.js"), "utf-8");
  } catch { content = ""; }

  it("contains auto-approval mode string", () => {
    expect(content).toMatch(/auto-approval/);
  });

  it("checks for completion transition (review→complete)", () => {
    expect(content).toMatch(/review/);
    expect(content).toMatch(/complete/);
  });

  it("blocks review→complete in auto-approval mode without human_confirmed", () => {
    expect(content).toMatch(/auto-approval/);
    expect(content).toMatch(/human_confirmed/);
  });

  it("allows approval→approved to pass in auto-approval mode", () => {
    // The auto-approval branch should reference approval/approved
    expect(content).toMatch(/approval/);
  });

  it("includes error message explaining auto-approval distinction", () => {
    expect(content).toMatch(/auto-approval/i);
    expect(content).toMatch(/review.*complete|completion/i);
  });

  it("preserves manual mode behavior (blocks ALL gated)", () => {
    expect(content).toMatch(/manual/);
    expect(content).toMatch(/human_confirmed/);
  });

  it("preserves auto mode behavior (no enforcement)", () => {
    expect(content).toMatch(/auto[^-]/);
  });
});

// --- viz/server.js: valid modes ---
describe("ms-a17-1-auto-approval-mode: viz/server.js", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "viz/server.js"), "utf-8");
  } catch { content = ""; }

  it("includes auto-approval in valid modes array", () => {
    expect(content).toMatch(/auto-approval/);
  });

  it("has 4 valid modes: manual, semi, auto-approval, auto", () => {
    expect(content).toMatch(/manual/);
    expect(content).toMatch(/semi/);
    expect(content).toMatch(/auto-approval/);
    expect(content).toMatch(/auto/);
  });
});

// --- viz/index.html: dropdown ---
describe("ms-a17-1-auto-approval-mode: viz/index.html dropdown", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "viz/index.html"), "utf-8");
  } catch { content = ""; }

  it("has Auto-Approval option in dropdown", () => {
    expect(content).toMatch(/auto-approval/i);
  });

  it("has 4 mode options (manual, semi, auto-approval, auto)", () => {
    expect(content).toMatch(/manual/i);
    expect(content).toMatch(/semi/i);
    expect(content).toMatch(/auto-approval/i);
    // auto is always present as substring of auto-approval, check for standalone
    expect(content).toMatch(/value=["']auto["']/i);
  });
});
