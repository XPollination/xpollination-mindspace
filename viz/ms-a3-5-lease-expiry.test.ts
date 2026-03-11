/**
 * TDD tests for ms-a3-5-lease-expiry
 *
 * Verifies lease expiry checker (cron/interval):
 * - Interval job every 60s
 * - Queries expired active leases
 * - Sets lease status=expired, unclaims task
 * - Transaction-safe per lease
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/services/lease-expiry.ts:
 *   - startLeaseExpiryJob() — starts 60s interval
 *   - stopLeaseExpiryJob() — clears interval
 *   - checkExpiredLeases() — core logic:
 *     - Query: SELECT * FROM leases WHERE status='active' AND expires_at < datetime('now')
 *     - For each expired lease (in transaction):
 *       - SET lease status='expired'
 *       - SET task claimed_by=NULL
 *       - Return task to pool
 *   - Returns count of expired leases processed
 * - Update index.ts to start job on server start
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-5-lease-expiry: service", () => {
  it("lease-expiry service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/lease-expiry.ts"),
      resolve(API_DIR, "services/leaseExpiry.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/lease-expiry.ts"),
      resolve(API_DIR, "services/leaseExpiry.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports startLeaseExpiryJob", () => {
    expect(content).toMatch(/export.*startLeaseExpiryJob|exports.*startLeaseExpiryJob/);
  });

  it("exports stopLeaseExpiryJob", () => {
    expect(content).toMatch(/export.*stopLeaseExpiryJob|exports.*stopLeaseExpiryJob/);
  });

  it("has checkExpiredLeases function", () => {
    expect(content).toMatch(/checkExpiredLeases|check.*expired/i);
  });

  it("queries for expired active leases", () => {
    expect(content).toMatch(/expires_at/);
    expect(content).toMatch(/active/);
  });

  it("sets lease status to expired", () => {
    expect(content).toMatch(/expired/);
  });

  it("unclaims task (claimed_by NULL)", () => {
    expect(content).toMatch(/claimed_by.*NULL|unclaim/i);
  });

  it("uses transaction for safety", () => {
    expect(content).toMatch(/transaction/i);
  });

  it("uses 60s interval", () => {
    expect(content).toMatch(/60|setInterval/i);
  });
});

describe("ms-a3-5-lease-expiry: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "index.ts"), "utf-8");
  } catch { content = ""; }

  it("starts lease expiry job on server start", () => {
    expect(content).toMatch(/leaseExpiry|lease.*expiry|startLeaseExpiry/i);
  });
});
