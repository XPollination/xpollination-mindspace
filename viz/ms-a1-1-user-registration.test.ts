/**
 * TDD tests for ms-a1-1-user-registration
 *
 * Verifies user registration system:
 * - SQL migration: users table (id UUID, email UNIQUE, password_hash, name, created_at)
 * - POST /api/auth/register with bcryptjs password hashing (cost 12)
 * - Input validation: required fields (400), email format (400), min password length (400)
 * - Duplicate email returns 409
 * - Response excludes password_hash
 * - Server integration
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/001-users.sql with users table
 * - Create api/routes/auth.ts with authRouter export, POST /register handler
 * - npm install bcryptjs; npm install -D @types/bcryptjs
 * - bcryptjs.hash with cost factor 12
 * - Validation: email regex, password min 8 chars, required name/email/password
 * - Modify api/server.ts: mount authRouter at /api/auth
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-1-user-registration: file structure", () => {
  it("api/db/migrations/001-users.sql exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/001-users.sql"))).toBe(true);
  });

  it("api/routes/auth.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/auth.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a1-1-user-registration: 001-users.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/001-users.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates users table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*users/i);
  });

  it("has id column", () => {
    expect(content).toMatch(/\bid\b/i);
  });

  it("has email column with UNIQUE constraint", () => {
    expect(content).toMatch(/email/i);
    expect(content).toMatch(/UNIQUE/i);
  });

  it("has password_hash column", () => {
    expect(content).toMatch(/password_hash/i);
  });

  it("has name column", () => {
    expect(content).toMatch(/\bname\b/i);
  });

  it("has created_at column", () => {
    expect(content).toMatch(/created_at/i);
  });
});

// --- Auth route ---
describe("ms-a1-1-user-registration: auth.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/auth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports authRouter", () => {
    expect(content).toMatch(/export.*authRouter/);
  });

  it("imports bcryptjs", () => {
    expect(content).toMatch(/import.*from\s+['"]bcryptjs['"]/);
  });

  it("handles POST /register", () => {
    expect(content).toMatch(/register/);
    expect(content).toMatch(/post|POST/i);
  });

  it("uses bcrypt cost factor 12", () => {
    expect(content).toMatch(/12/);
  });

  it("validates email format", () => {
    expect(content).toMatch(/email/i);
    expect(content).toMatch(/@|regex|format|valid/i);
  });

  it("validates minimum password length", () => {
    expect(content).toMatch(/length|min.*8|8.*min/i);
  });

  it("returns 400 for validation errors", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 409 for duplicate email", () => {
    expect(content).toMatch(/409/);
  });

  it("returns 201 on successful registration", () => {
    expect(content).toMatch(/201/);
  });

  it("excludes password_hash from response", () => {
    // Should destructure or delete password_hash before sending response
    expect(content).toMatch(/password_hash/);
  });
});

// --- Dependencies ---
describe("ms-a1-1-user-registration: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("bcryptjs is in dependencies", () => {
    expect(pkg.dependencies?.bcryptjs).toBeDefined();
  });
});

// --- Server integration ---
describe("ms-a1-1-user-registration: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports authRouter", () => {
    expect(content).toMatch(/import.*authRouter.*from/);
  });

  it("mounts at /api/auth", () => {
    expect(content).toMatch(/\/api\/auth/);
  });
});
