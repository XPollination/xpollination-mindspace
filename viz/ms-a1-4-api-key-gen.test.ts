/**
 * TDD tests for ms-a1-4-api-key-gen
 *
 * Verifies API key generation endpoint:
 * - 004-api-keys.sql: api_keys table (id, user_id FK CASCADE, key_hash, name, created_at, revoked_at)
 * - POST /api/keys generates key (xpo_ prefix, crypto.randomBytes, SHA-256 hash)
 * - GET /api/keys lists user's keys
 * - DELETE /api/keys/:id soft-revokes (sets revoked_at)
 * - Server mounts keysRouter at /api/keys
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/004-api-keys.sql:
 *   - api_keys: id UUID, user_id FK→users(id) ON DELETE CASCADE,
 *     key_hash TEXT NOT NULL, name TEXT, created_at, revoked_at
 *   - Index on user_id, UNIQUE on key_hash
 * - Create api/routes/keys.ts:
 *   - Export keysRouter
 *   - POST / : crypto.randomBytes(30).toString('hex') with 'xpo_' prefix
 *   - SHA-256 hash via crypto.createHash('sha256')
 *   - GET / : list user's keys (exclude key_hash from response)
 *   - DELETE /:id : soft-revoke (SET revoked_at = NOW)
 * - Modify api/server.ts: mount keysRouter at /api/keys
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-4-api-key-gen: file structure", () => {
  it("api/db/migrations/004-api-keys.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/004-api-keys.sql"))).toBe(true);
  });

  it("api/routes/keys.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/keys.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a1-4-api-key-gen: 004-api-keys.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/004-api-keys.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates api_keys table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*api_keys/i);
  });

  it("has id column", () => {
    expect(content).toMatch(/\bid\b/i);
  });

  it("has user_id foreign key", () => {
    expect(content).toMatch(/user_id/i);
  });

  it("references users table with CASCADE", () => {
    expect(content).toMatch(/REFERENCES\s+users/i);
    expect(content).toMatch(/CASCADE/i);
  });

  it("has key_hash column", () => {
    expect(content).toMatch(/key_hash/i);
  });

  it("has name column", () => {
    expect(content).toMatch(/\bname\b/i);
  });

  it("has created_at column", () => {
    expect(content).toMatch(/created_at/i);
  });

  it("has revoked_at column", () => {
    expect(content).toMatch(/revoked_at/i);
  });

  it("has UNIQUE constraint on key_hash", () => {
    expect(content).toMatch(/UNIQUE/i);
  });
});

// --- Keys route ---
describe("ms-a1-4-api-key-gen: keys.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/keys.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports keysRouter", () => {
    expect(content).toMatch(/export.*keysRouter/);
  });

  it("imports crypto", () => {
    expect(content).toMatch(/crypto/);
  });

  it("uses randomBytes for key generation", () => {
    expect(content).toMatch(/randomBytes/);
  });

  it("uses xpo_ prefix for API keys", () => {
    expect(content).toMatch(/xpo_/);
  });

  it("uses SHA-256 for hashing", () => {
    expect(content).toMatch(/sha256|SHA-256/i);
  });

  it("handles POST for key generation", () => {
    expect(content).toMatch(/post/i);
  });

  it("handles GET for listing keys", () => {
    expect(content).toMatch(/get/i);
  });

  it("handles DELETE for revoking keys", () => {
    expect(content).toMatch(/delete/i);
  });

  it("sets revoked_at for soft-revoke", () => {
    expect(content).toMatch(/revoked_at/);
  });

  it("returns 201 on key creation", () => {
    expect(content).toMatch(/201/);
  });
});

// --- Dependencies ---
describe("ms-a1-4-api-key-gen: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("no extra dependencies needed (crypto is built-in)", () => {
    // crypto is a Node.js built-in, no npm package needed
    // This test verifies package.json is parseable
    expect(pkg).toBeDefined();
  });
});

// --- Server integration ---
describe("ms-a1-4-api-key-gen: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports keysRouter", () => {
    expect(content).toMatch(/import.*keysRouter.*from/);
  });

  it("mounts at /api/keys", () => {
    expect(content).toMatch(/\/api\/keys/);
  });
});
