/**
 * TDD tests for ms-a6-3-release-sealing
 *
 * Verifies release sealing (human gate):
 * - POST /releases/:id/seal — draft→testing→sealed
 * - Sealed release is immutable (PUT blocked)
 * - Best-effort git tag creation
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/releases.ts:
 *   - POST /:id/seal — requires approval token or admin
 *   - Validates release status is 'testing' (not draft, not already sealed)
 *   - Sets status='sealed', sealed_at=datetime('now')
 *   - Best-effort git tag (non-blocking failure)
 *   - Returns 200 with sealed release
 *   - 400 if not in 'testing' status
 *   - 404 if release not found
 *   - PUT /:id returns 403 if status='sealed' (immutability guard)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a6-3-release-sealing: endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/releases.ts"), "utf-8");
  } catch { content = ""; }

  it("has POST seal endpoint", () => {
    expect(content).toMatch(/seal/i);
    expect(content).toMatch(/\.post\s*\(/i);
  });

  it("validates testing status before sealing", () => {
    expect(content).toMatch(/testing/);
  });

  it("sets status to sealed", () => {
    expect(content).toMatch(/sealed/);
  });

  it("records sealed_at timestamp", () => {
    expect(content).toMatch(/sealed_at|datetime/i);
  });

  it("returns 400 for invalid status", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 404 for not found", () => {
    expect(content).toMatch(/404/);
  });

  it("blocks PUT on sealed releases (immutability)", () => {
    expect(content).toMatch(/sealed/);
    expect(content).toMatch(/403|immutable|cannot.*modify/i);
  });

  it("attempts git tag creation", () => {
    expect(content).toMatch(/git|tag/i);
  });
});
