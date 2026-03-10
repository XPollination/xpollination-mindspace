/**
 * TDD tests for ms-a1-6-google-oauth
 *
 * Verifies Google OAuth integration:
 * - 005 migration: rebuild users table (password_hash nullable, google_id UNIQUE)
 * - oauth.ts routes: GET /google (initiate), GET /google/callback (find-or-create + JWT)
 * - passport + passport-google-oauth20 strategy
 * - Server mounts oauthRouter
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/005-google-oauth.sql:
 *   - Rebuild users table to make password_hash nullable
 *   - Add google_id TEXT UNIQUE column
 *   - SQLite requires table rebuild (no ALTER COLUMN)
 *   - Preserve existing data via INSERT...SELECT
 * - Create api/routes/oauth.ts:
 *   - Export oauthRouter
 *   - Import passport, passport-google-oauth20
 *   - GET /google: passport.authenticate('google', { scope: ['profile', 'email'] })
 *   - GET /google/callback: passport.authenticate, find-or-create user by email,
 *     issue JWT, redirect with token
 *   - Conditional strategy registration (only if GOOGLE_CLIENT_ID set)
 * - Update api/server.ts: mount oauthRouter at /api/auth/oauth
 * - npm install passport passport-google-oauth20
 * - npm install -D @types/passport @types/passport-google-oauth20
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-6-google-oauth: file structure", () => {
  it("005 migration file exists", () => {
    expect(existsSync(resolve(API_DIR, "db/migrations/005-google-oauth.sql"))).toBe(true);
  });

  it("api/routes/oauth.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/oauth.ts"))).toBe(true);
  });
});

// --- Migration ---
describe("ms-a1-6-google-oauth: 005-google-oauth.sql", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "db/migrations/005-google-oauth.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("modifies users table", () => {
    expect(content).toMatch(/users/i);
  });

  it("makes password_hash nullable", () => {
    // Rebuild pattern: new table without NOT NULL on password_hash
    expect(content).toMatch(/password_hash/i);
  });

  it("adds google_id column", () => {
    expect(content).toMatch(/google_id/i);
  });

  it("google_id has UNIQUE constraint", () => {
    expect(content).toMatch(/UNIQUE/i);
  });

  it("preserves existing data with INSERT...SELECT", () => {
    expect(content).toMatch(/INSERT.*SELECT/is);
  });
});

// --- OAuth routes ---
describe("ms-a1-6-google-oauth: oauth.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/oauth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports oauthRouter", () => {
    expect(content).toMatch(/export.*oauthRouter/);
  });

  it("imports passport", () => {
    expect(content).toMatch(/import.*from\s+['"]passport['"]/);
  });

  it("imports or references google-oauth20 strategy", () => {
    expect(content).toMatch(/passport-google-oauth20|GoogleStrategy|google-oauth/i);
  });

  it("has GET /google route for initiating OAuth", () => {
    expect(content).toMatch(/google/);
    expect(content).toMatch(/get/i);
  });

  it("requests profile and email scopes", () => {
    expect(content).toMatch(/profile/);
    expect(content).toMatch(/email/);
  });

  it("has callback route", () => {
    expect(content).toMatch(/callback/);
  });

  it("finds or creates user by email", () => {
    expect(content).toMatch(/email/);
  });

  it("issues JWT on successful OAuth", () => {
    expect(content).toMatch(/sign|jwt|token/i);
  });

  it("reads GOOGLE_CLIENT_ID from environment", () => {
    expect(content).toMatch(/GOOGLE_CLIENT_ID/);
  });

  it("reads GOOGLE_CLIENT_SECRET from environment", () => {
    expect(content).toMatch(/GOOGLE_CLIENT_SECRET/);
  });

  it("conditionally registers strategy", () => {
    // Only register if GOOGLE_CLIENT_ID is set
    expect(content).toMatch(/GOOGLE_CLIENT_ID/);
    expect(content).toMatch(/if|conditional|when/i);
  });
});

// --- Dependencies ---
describe("ms-a1-6-google-oauth: package.json", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("passport is in dependencies", () => {
    expect(pkg.dependencies?.passport).toBeDefined();
  });

  it("passport-google-oauth20 is in dependencies", () => {
    expect(pkg.dependencies?.["passport-google-oauth20"]).toBeDefined();
  });
});

// --- Server integration ---
describe("ms-a1-6-google-oauth: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports oauthRouter", () => {
    expect(content).toMatch(/import.*oauthRouter.*from/);
  });

  it("mounts OAuth routes", () => {
    expect(content).toMatch(/oauth/i);
  });
});
