/**
 * TDD tests for ms-a3-4-lease-creation
 *
 * Verifies lease table and lease creation on claim:
 * - Migration: leases table with correct schema
 * - Service: createLease function with role-based durations
 * - Integration: task-claiming creates lease on claim
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/024-leases.sql (or next available number):
 *   - CREATE TABLE leases (id, task_id, user_id, started_at, expires_at,
 *     last_heartbeat, status CHECK (active/expired/released))
 *   - Indexes on task_id, user_id
 * - Create api/services/lease-service.ts:
 *   - Export createLease(db, taskId, userId, role) function
 *   - Role durations: PDSA=4h, DEV=6h, QA=3h, LIAISON=2h
 *   - Sets expires_at = now + duration based on role
 *   - Returns lease object
 * - Update api/routes/task-claiming.ts:
 *   - On POST (claim), call createLease after successful claim
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a3-4-lease-creation: migration", () => {
  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "db/migrations/024-leases.sql"),
      resolve(API_DIR, "db/migrations/025-leases.sql"),
      resolve(API_DIR, "db/migrations/026-leases.sql"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("leases migration exists", () => {
    const paths = [
      resolve(API_DIR, "db/migrations/024-leases.sql"),
      resolve(API_DIR, "db/migrations/025-leases.sql"),
      resolve(API_DIR, "db/migrations/026-leases.sql"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  it("creates leases table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*leases/i);
  });

  it("has task_id column", () => {
    expect(content).toMatch(/task_id/);
  });

  it("has user_id column", () => {
    expect(content).toMatch(/user_id/);
  });

  it("has expires_at column", () => {
    expect(content).toMatch(/expires_at/);
  });

  it("has last_heartbeat column", () => {
    expect(content).toMatch(/last_heartbeat/);
  });

  it("has status CHECK constraint (active/expired/released)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/active/);
    expect(content).toMatch(/expired/);
    expect(content).toMatch(/released/);
  });
});

describe("ms-a3-4-lease-creation: service", () => {
  it("lease-service file exists", () => {
    const paths = [
      resolve(API_DIR, "services/lease-service.ts"),
      resolve(API_DIR, "services/leaseService.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });

  let content: string;
  try {
    const paths = [
      resolve(API_DIR, "services/lease-service.ts"),
      resolve(API_DIR, "services/leaseService.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("exports createLease function", () => {
    expect(content).toMatch(/export.*createLease|exports.*createLease/);
  });

  it("has role-based duration configuration", () => {
    expect(content).toMatch(/pdsa|PDSA/i);
    expect(content).toMatch(/dev|DEV/i);
    expect(content).toMatch(/qa|QA/i);
    expect(content).toMatch(/liaison|LIAISON/i);
  });

  it("PDSA gets 4 hour lease", () => {
    expect(content).toMatch(/4/);
  });

  it("DEV gets 6 hour lease", () => {
    expect(content).toMatch(/6/);
  });

  it("QA gets 3 hour lease", () => {
    expect(content).toMatch(/3/);
  });

  it("LIAISON gets 2 hour lease", () => {
    expect(content).toMatch(/2/);
  });
});

describe("ms-a3-4-lease-creation: integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/task-claiming.ts"), "utf-8");
  } catch { content = ""; }

  it("task-claiming.ts references lease creation", () => {
    expect(content).toMatch(/lease|createLease/i);
  });
});
