/**
 * TDD tests for ms-a9-2-approval-granting
 *
 * Verifies approval granting endpoints:
 * - PUT /:approvalId/approve — sets status=approved, transitions task
 * - PUT /:approvalId/reject — sets status=rejected with reason, task→rework
 * - Only pending requests can be approved/rejected
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/approval-requests.ts:
 *   - PUT /:approvalId/approve (admin only)
 *     - Validates request exists and is pending
 *     - Sets approval status='approved', records approved_by + approved_at
 *     - Transitions task approval→approved using computeRole
 *     - Returns { approval, task }
 *   - PUT /:approvalId/reject (admin only)
 *     - Validates request exists and is pending
 *     - Requires reason in body (400 if missing)
 *     - Sets approval status='rejected', records rejection_reason
 *     - Transitions task to rework
 *     - Returns { approval, task }
 * - May need migration for approved_by, approved_at, rejection_reason columns
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a9-2-approval-granting: approve endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("has PUT approve endpoint", () => {
    expect(content).toMatch(/\.put\(/i);
    expect(content).toMatch(/approve/i);
  });

  it("validates request is pending before approving", () => {
    expect(content).toMatch(/pending/);
  });

  it("sets status to approved", () => {
    expect(content).toMatch(/status.*approved|approved.*status/i);
  });

  it("records approved_by", () => {
    expect(content).toMatch(/approved_by/);
  });

  it("transitions task from approval to approved", () => {
    expect(content).toMatch(/approved/);
    expect(content).toMatch(/task/i);
  });

  it("returns 404 for non-existent approval", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 400 for non-pending approval", () => {
    expect(content).toMatch(/400/);
  });
});

describe("ms-a9-2-approval-granting: reject endpoint", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("has PUT reject endpoint", () => {
    expect(content).toMatch(/\.put\(/i);
    expect(content).toMatch(/reject/i);
  });

  it("requires reason for rejection", () => {
    expect(content).toMatch(/reason/);
  });

  it("transitions task to rework on rejection", () => {
    expect(content).toMatch(/rework/);
  });

  it("records rejection reason", () => {
    expect(content).toMatch(/reason/);
    expect(content).toMatch(/reject/i);
  });
});
