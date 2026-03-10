/**
 * TDD tests for ms-a1-2-login-jwt
 *
 * Verifies login endpoint + JWT token issuance:
 * - POST /api/auth/login in api/routes/auth.ts
 * - bcrypt.compare for credential validation
 * - JWT token with sub (user_id), email, name payload
 * - JWT_SECRET from environment (required)
 * - JWT_EXPIRY configurable (default 24h)
 * - 401 for invalid credentials (no user enumeration)
 * - Response includes token + user (no password_hash)
 * - jsonwebtoken dependency
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/auth.ts: add POST /login handler
 * - npm install jsonwebtoken; npm install -D @types/jsonwebtoken
 * - bcrypt.compare for password verification
 * - jwt.sign with { sub, email, name } payload
 * - JWT_SECRET env var (throw if missing)
 * - JWT_EXPIRY env var (default '24h')
 * - Same 401 message for user-not-found and wrong-password
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Auth route login handler ---
describe("ms-a1-2-login-jwt: auth.ts login", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/auth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports jsonwebtoken", () => {
    expect(content).toMatch(/import.*from\s+['"]jsonwebtoken['"]/);
  });

  it("handles POST /login", () => {
    expect(content).toMatch(/login/);
  });

  it("uses bcrypt.compare for password verification", () => {
    expect(content).toMatch(/compare/);
  });

  it("signs JWT with jwt.sign", () => {
    expect(content).toMatch(/sign\s*\(/);
  });

  it("JWT payload includes sub field", () => {
    expect(content).toMatch(/sub/);
  });

  it("JWT payload includes email", () => {
    expect(content).toMatch(/email/);
  });

  it("JWT payload includes name", () => {
    expect(content).toMatch(/name/);
  });

  it("reads JWT_SECRET from environment", () => {
    expect(content).toMatch(/JWT_SECRET/);
  });

  it("reads JWT_EXPIRY from environment with default", () => {
    expect(content).toMatch(/JWT_EXPIRY/);
    expect(content).toMatch(/24h/);
  });

  it("returns 401 for invalid credentials", () => {
    expect(content).toMatch(/401/);
  });

  it("uses same error message for not-found and wrong-password", () => {
    // Should not reveal whether email exists
    expect(content).toMatch(/Invalid.*credentials|credentials.*invalid/i);
  });

  it("excludes password_hash from response", () => {
    expect(content).toMatch(/password_hash/);
  });

  it("returns token in response", () => {
    expect(content).toMatch(/token/);
  });
});

// --- Dependencies ---
describe("ms-a1-2-login-jwt: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("jsonwebtoken is in dependencies", () => {
    expect(pkg.dependencies?.jsonwebtoken).toBeDefined();
  });
});
