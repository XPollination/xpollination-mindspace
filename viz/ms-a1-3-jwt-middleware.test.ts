/**
 * TDD tests for ms-a1-3-jwt-middleware
 *
 * Verifies JWT verification middleware:
 * - middleware/auth.ts: extracts Bearer token from Authorization header,
 *   jwt.verify with JWT_SECRET, attaches req.user (sub→id mapping)
 * - types/express.d.ts: TypeScript augmentation for req.user
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/middleware/auth.ts:
 *   - Export requireAuth middleware function
 *   - Extract token from Authorization: Bearer <token> header
 *   - jwt.verify with JWT_SECRET from environment
 *   - Map decoded sub field to req.user.id
 *   - Attach email, name from decoded payload to req.user
 *   - Return 401 for missing/invalid/expired tokens
 *   - Import jsonwebtoken
 * - Create api/types/express.d.ts:
 *   - Augment Express Request interface with user property
 *   - user: { id: string, email: string, name: string }
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a1-3-jwt-middleware: file structure", () => {
  it("api/middleware/auth.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/auth.ts"))).toBe(true);
  });

  it("api/types/express.d.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "types/express.d.ts"))).toBe(true);
  });
});

// --- middleware/auth.ts ---
describe("ms-a1-3-jwt-middleware: auth.ts middleware", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/auth.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports requireAuth middleware", () => {
    expect(content).toMatch(/export.*requireAuth/);
  });

  it("imports jsonwebtoken", () => {
    expect(content).toMatch(/import.*from\s+['"]jsonwebtoken['"]/);
  });

  it("extracts Bearer token from Authorization header", () => {
    expect(content).toMatch(/[Bb]earer/);
    expect(content).toMatch(/[Aa]uthorization/);
  });

  it("uses jwt.verify for token validation", () => {
    expect(content).toMatch(/verify\s*\(/);
  });

  it("reads JWT_SECRET from environment", () => {
    expect(content).toMatch(/JWT_SECRET/);
  });

  it("maps sub to user id", () => {
    expect(content).toMatch(/sub/);
  });

  it("attaches email to req.user", () => {
    expect(content).toMatch(/email/);
  });

  it("attaches name to req.user", () => {
    expect(content).toMatch(/name/);
  });

  it("sets req.user", () => {
    expect(content).toMatch(/req\.user|req\[.user.\]/);
  });

  it("returns 401 for invalid tokens", () => {
    expect(content).toMatch(/401/);
  });

  it("calls next() on success", () => {
    expect(content).toMatch(/next\s*\(/);
  });
});

// --- types/express.d.ts ---
describe("ms-a1-3-jwt-middleware: express.d.ts type augmentation", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "types/express.d.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("augments Express namespace", () => {
    expect(content).toMatch(/express/i);
  });

  it("declares user property on Request", () => {
    expect(content).toMatch(/user/);
  });

  it("includes id field in user type", () => {
    expect(content).toMatch(/\bid\b/);
  });

  it("includes email field in user type", () => {
    expect(content).toMatch(/email/);
  });

  it("includes name field in user type", () => {
    expect(content).toMatch(/name/);
  });
});
