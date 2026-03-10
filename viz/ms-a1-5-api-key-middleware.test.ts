/**
 * TDD tests for ms-a1-5-api-key-middleware
 *
 * Verifies API key verification middleware:
 * - api-key-auth.ts: extracts X-API-Key header, SHA-256 hash lookup,
 *   checks revoked_at, sets req.user, falls through if no header
 * - require-auth.ts: combined requireApiKeyOrJwt middleware
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/middleware/api-key-auth.ts:
 *   - Export apiKeyAuth middleware function
 *   - Extract key from X-API-Key header
 *   - SHA-256 hash the key via crypto.createHash('sha256')
 *   - Query api_keys JOIN users by key_hash
 *   - Check revoked_at — if set, return 401
 *   - Set req.user = { id, email, name } (same shape as JWT middleware)
 *   - If no X-API-Key header, call next() (fall-through to JWT)
 *   - Return 401 for invalid/unknown keys
 * - Create api/middleware/require-auth.ts:
 *   - Export requireApiKeyOrJwt that chains apiKeyAuth + JWT fallback
 *   - If neither auth succeeds, return 401
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-5-api-key-middleware: file structure", () => {
  it("api/middleware/api-key-auth.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/api-key-auth.ts"))).toBe(true);
  });

  it("api/middleware/require-auth.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/require-auth.ts"))).toBe(true);
  });
});

// --- api-key-auth.ts ---
describe("ms-a1-5-api-key-middleware: api-key-auth.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/api-key-auth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports apiKeyAuth middleware", () => {
    expect(content).toMatch(/export.*apiKeyAuth/);
  });

  it("imports crypto", () => {
    expect(content).toMatch(/crypto/);
  });

  it("reads X-API-Key header", () => {
    expect(content).toMatch(/x-api-key|X-API-Key/i);
  });

  it("uses SHA-256 for hashing", () => {
    expect(content).toMatch(/sha256|SHA-256/i);
  });

  it("queries api_keys table", () => {
    expect(content).toMatch(/api_keys/);
  });

  it("JOINs with users table", () => {
    expect(content).toMatch(/JOIN.*users|users.*JOIN/i);
  });

  it("checks revoked_at for revoked keys", () => {
    expect(content).toMatch(/revoked_at/);
  });

  it("returns 401 for revoked keys", () => {
    expect(content).toMatch(/401/);
  });

  it("sets req.user with user data", () => {
    expect(content).toMatch(/req\.user|req\[.user.\]/);
  });

  it("falls through with next() when no API key header", () => {
    expect(content).toMatch(/next\s*\(/);
  });
});

// --- require-auth.ts ---
describe("ms-a1-5-api-key-middleware: require-auth.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/require-auth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports requireApiKeyOrJwt", () => {
    expect(content).toMatch(/export.*requireApiKeyOrJwt/);
  });

  it("imports or references apiKeyAuth", () => {
    expect(content).toMatch(/apiKeyAuth|api-key-auth/);
  });

  it("references JWT middleware", () => {
    expect(content).toMatch(/jwt|JWT|jwtAuth|verifyToken/i);
  });

  it("returns 401 when neither auth succeeds", () => {
    expect(content).toMatch(/401/);
  });
});
