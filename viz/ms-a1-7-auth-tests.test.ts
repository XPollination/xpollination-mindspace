/**
 * TDD tests for ms-a1-7-auth-tests
 *
 * Verifies auth integration test suite infrastructure:
 * - api/test-helpers/setup.ts: reusable DB setup with migration runner
 * - api/__tests__/auth.integration.test.ts: supertest HTTP integration tests
 * - 26 test cases across 6 groups: registration, login, JWT, API keys, combined, expiry
 * - supertest dependency in package.json
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/test-helpers/setup.ts:
 *   - Export createTestApp or setupTestDb function
 *   - In-memory SQLite (better-sqlite3 with :memory:)
 *   - Run migrations from api/db/migrations/*.sql
 *   - Return app instance or db + app for supertest
 * - Create api/__tests__/auth.integration.test.ts:
 *   - Import supertest
 *   - Import test helper setup
 *   - Registration tests (5): valid, missing fields, bad email, short password, duplicate
 *   - Login tests (4): valid, wrong password, unknown email, missing fields
 *   - JWT validation tests (4): protected route with valid token, expired token, invalid token, missing token
 *   - API key lifecycle tests (6): generate, list, revoke, use valid key, use revoked key, use invalid key
 *   - Combined middleware tests (2): API key bypasses JWT, both missing returns 401
 *   - Token expiry tests (2): near-expiry token works, expired token rejected
 * - npm install -D supertest @types/supertest
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-7-auth-tests: file structure", () => {
  it("api/test-helpers/setup.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "test-helpers/setup.ts"))).toBe(true);
  });

  it("auth integration test file exists", () => {
    // May be at __tests__/auth.integration.test.ts or similar
    const paths = [
      resolve(API_DIR, "__tests__/auth.integration.test.ts"),
      resolve(API_DIR, "__tests__/auth.test.ts"),
      resolve(API_DIR, "tests/auth.integration.test.ts"),
    ];
    expect(paths.some((p) => existsSync(p))).toBe(true);
  });
});

// --- Test helper ---
describe("ms-a1-7-auth-tests: test-helpers/setup.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "test-helpers/setup.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports setup function", () => {
    expect(content).toMatch(/export/);
  });

  it("uses in-memory SQLite", () => {
    expect(content).toMatch(/:memory:/);
  });

  it("runs migrations", () => {
    expect(content).toMatch(/migration|\.sql/i);
  });

  it("references better-sqlite3 or database", () => {
    expect(content).toMatch(/better-sqlite3|sqlite|Database/i);
  });
});

// --- Integration test file ---
describe("ms-a1-7-auth-tests: auth integration tests", () => {
  let content: string;
  try {
    // Try multiple possible paths
    const paths = [
      resolve(API_DIR, "__tests__/auth.integration.test.ts"),
      resolve(API_DIR, "__tests__/auth.test.ts"),
      resolve(API_DIR, "tests/auth.integration.test.ts"),
    ];
    content = "";
    for (const p of paths) {
      try {
        content = readFileSync(p, "utf-8");
        if (content) break;
      } catch {}
    }
  } catch {
    content = "";
  }

  it("imports supertest", () => {
    expect(content).toMatch(/supertest/);
  });

  it("imports test helper setup", () => {
    expect(content).toMatch(/setup|test-helpers/i);
  });

  // Registration group
  it("tests valid registration (201)", () => {
    expect(content).toMatch(/register/i);
    expect(content).toMatch(/201/);
  });

  it("tests registration validation (400)", () => {
    expect(content).toMatch(/400/);
  });

  it("tests duplicate email (409)", () => {
    expect(content).toMatch(/409/);
  });

  // Login group
  it("tests valid login", () => {
    expect(content).toMatch(/login/i);
  });

  it("tests invalid credentials (401)", () => {
    expect(content).toMatch(/401/);
  });

  // JWT group
  it("tests protected route with valid token", () => {
    expect(content).toMatch(/[Aa]uthorization|[Bb]earer/);
  });

  it("tests missing token rejection", () => {
    expect(content).toMatch(/missing|without|no.*token/i);
  });

  // API key group
  it("tests API key generation", () => {
    expect(content).toMatch(/api.*key|X-API-Key/i);
  });

  it("tests API key listing", () => {
    expect(content).toMatch(/list|keys/i);
  });

  it("tests API key revocation", () => {
    expect(content).toMatch(/revok|delete/i);
  });

  // Combined middleware
  it("tests API key bypasses JWT", () => {
    expect(content).toMatch(/X-API-Key|api.key/i);
  });
});

// --- Dependencies ---
describe("ms-a1-7-auth-tests: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("supertest is in devDependencies", () => {
    expect(
      pkg.devDependencies?.supertest || pkg.dependencies?.supertest
    ).toBeDefined();
  });
});
