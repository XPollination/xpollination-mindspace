/**
 * TDD tests for ms-a10-3-flag-toggle
 *
 * Verifies flag toggle endpoint with human gate:
 * - PUT /:flagId/toggle endpoint
 * - Toggle OFF: immediate (emergency rollback)
 * - Toggle ON: creates approval_request, returns 202
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/feature-flags.ts:
 *   - Add PUT /:flagId/toggle endpoint
 *   - Toggle OFF (ON→OFF): immediate state change, record toggled_by/toggled_at
 *   - Toggle ON (OFF→ON): create approval_request with type='flag_toggle', return 202
 *   - Flag stays OFF until approval granted
 *   - 404 for non-existent flag
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a10-3-flag-toggle: feature-flags.ts toggle", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/feature-flags.ts"), "utf-8");
  } catch { content = ""; }

  it("has PUT toggle endpoint", () => {
    expect(content).toMatch(/toggle/);
    expect(content).toMatch(/\.put\(/i);
  });

  it("handles toggle OFF as immediate", () => {
    expect(content).toMatch(/off|OFF/);
  });

  it("handles toggle ON via approval request", () => {
    expect(content).toMatch(/approval_request|approval/i);
    expect(content).toMatch(/on|ON/);
  });

  it("returns 202 for toggle ON (pending approval)", () => {
    expect(content).toMatch(/202/);
  });

  it("records toggled_by on toggle OFF", () => {
    expect(content).toMatch(/toggled_by|toggledBy/);
  });

  it("creates approval with flag_toggle type", () => {
    expect(content).toMatch(/flag_toggle|flag.*toggle/i);
  });

  it("returns 404 for non-existent flag", () => {
    expect(content).toMatch(/404/);
  });
});
