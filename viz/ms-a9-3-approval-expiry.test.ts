/**
 * TDD tests for ms-a9-3-approval-expiry
 *
 * Verifies approval expiry checker:
 * - Migration: expires_at column on approval_requests
 * - Service: checkExpiredApprovals function
 * - Route: POST /check-expiry endpoint
 * - Expired approvals → status='expired', task→rework
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/025-approval-expiry.sql:
 *   - ALTER TABLE approval_requests ADD COLUMN expires_at
 *   - Default: datetime('now', '+24 hours')
 * - Create api/services/approval-expiry.ts:
 *   - Export checkExpiredApprovals(db) function
 *   - Queries pending approvals where expires_at < now
 *   - Sets status='expired', transitions task to rework
 *   - Records transition in task_transitions
 * - Update api/routes/approval-requests.ts:
 *   - POST /check-expiry (admin only) triggers expiry check
 *   - Returns { expired_count, expired_ids }
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a9-3-approval-expiry: migration", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/025-approval-expiry.sql"),
      resolve(API_DIR, "db/migrations/026-approval-expiry.sql"),
      resolve(API_DIR, "db/migrations/024-approval-expiry.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("expiry migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/025-approval-expiry.sql"),
      resolve(API_DIR, "db/migrations/026-approval-expiry.sql"),
      resolve(API_DIR, "db/migrations/024-approval-expiry.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("adds expires_at column", () => {
    expect(content).toMatch(/expires_at/);
  });

  it("has default 24 hour expiry", () => {
    expect(content).toMatch(/24\s*hour|\+24/i);
  });
});

describe("ms-a9-3-approval-expiry: service", () => {
  it("approval-expiry service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/approval-expiry.ts"),
      resolve(API_DIR, "services/approvalExpiry.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/approval-expiry.ts"),
      resolve(API_DIR, "services/approvalExpiry.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports checkExpiredApprovals function", () => {
    expect(content).toMatch(/export.*checkExpiredApprovals|exports.*checkExpiredApprovals/);
  });

  it("queries pending approvals past expiry", () => {
    expect(content).toMatch(/pending/);
    expect(content).toMatch(/expires_at/);
  });

  it("sets expired status", () => {
    expect(content).toMatch(/expired/);
  });

  it("transitions task to rework", () => {
    expect(content).toMatch(/rework/);
  });

  it("records transition with system actor", () => {
    expect(content).toMatch(/system/i);
    expect(content).toMatch(/transition/i);
  });
});

describe("ms-a9-3-approval-expiry: route", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/approval-requests.ts"), "utf-8");
  } catch { content = ""; }

  it("has POST /check-expiry endpoint", () => {
    expect(content).toMatch(/check-expiry|checkExpiry/);
    expect(content).toMatch(/\.post\(/i);
  });

  it("returns expired count in response", () => {
    expect(content).toMatch(/expired_count|expiredCount/);
  });
});
