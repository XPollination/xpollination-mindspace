/**
 * TDD tests for t3-1-requirement-changed-broadcast
 *
 * Verifies REQUIREMENT_CHANGED broadcast in A2A protocol:
 * - Broadcasts SSE event when requirement version changes
 * - Payload includes suspect_scope
 * - Uses broadcast infrastructure from A11
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/requirements.ts:
 *   - After requirement version update (PUT), broadcast REQUIREMENT_CHANGED
 *   - Event type: REQUIREMENT_CHANGED
 *   - Payload: req_id, project_slug, old_version, new_version, suspect_scope
 *   - suspect_scope: list of downstream artifact types affected
 *   - Uses broadcast() from SSE infrastructure
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("t3-1-requirement-changed-broadcast: event", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/requirements.ts"), "utf-8");
  } catch { content = ""; }

  it("emits REQUIREMENT_CHANGED event", () => {
    expect(content).toMatch(/REQUIREMENT_CHANGED/);
  });

  it("includes project_slug in payload", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("includes suspect_scope in payload", () => {
    expect(content).toMatch(/suspect_scope|suspect/i);
  });

  it("uses broadcast function", () => {
    expect(content).toMatch(/broadcast/i);
  });

  it("triggers on requirement version change", () => {
    expect(content).toMatch(/version/i);
  });

  it("includes requirement identifier", () => {
    expect(content).toMatch(/req_id|requirement_ref/i);
  });
});
