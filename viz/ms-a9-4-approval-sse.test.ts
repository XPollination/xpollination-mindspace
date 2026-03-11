/**
 * TDD tests for ms-a9-4-approval-sse
 *
 * Verifies approval notification via A2A SSE:
 * - Emits TASK_APPROVED event on approval
 * - Emits TASK_REJECTED event on rejection
 * - Uses sendToAgent if connected, broadcast as fallback
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/approval-requests.ts:
 *   - After approve: emit TASK_APPROVED SSE event
 *   - After reject: emit TASK_REJECTED SSE event
 *   - Payload: approval_request_id, task_slug, decision, actor
 *   - Try sendToAgent(requesting_agent), fallback to broadcast
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a9-4-approval-sse: notification events", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("emits TASK_APPROVED event", () => {
    expect(content).toMatch(/TASK_APPROVED/);
  });

  it("emits TASK_REJECTED event", () => {
    expect(content).toMatch(/TASK_REJECTED/);
  });

  it("includes task_slug in payload", () => {
    expect(content).toMatch(/task_slug/);
  });

  it("uses sendToAgent or broadcast", () => {
    expect(content).toMatch(/sendToAgent|broadcast/i);
  });

  it("includes approval_request_id in payload", () => {
    expect(content).toMatch(/approval_request_id|request_id/i);
  });

  it("triggers on approve decision", () => {
    expect(content).toMatch(/approve/i);
  });

  it("triggers on reject decision", () => {
    expect(content).toMatch(/reject/i);
  });
});
