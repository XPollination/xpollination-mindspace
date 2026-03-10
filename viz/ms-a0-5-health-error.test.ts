/**
 * TDD tests for ms-a0-5-health-error
 *
 * Verifies error handling middleware:
 * - api/middleware/error-handler.ts with 4-param Express error handler
 * - api/middleware/not-found.ts for 404 catch-all
 * - Safe error responses (no stack traces leaked)
 * - Structured JSON error logging
 * - Server integration (middleware registered after routes)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/middleware/error-handler.ts with errorHandler(err, req, res, next)
 * - Create api/middleware/not-found.ts with notFoundHandler(req, res)
 * - Modify api/server.ts: register notFoundHandler after routes, errorHandler last
 * - Error handler logs structured JSON: {level, message, stack, timestamp}
 * - 500 errors return generic message, non-500 include err.message
 * - Support statusCode property on Error objects
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a0-5-health-error: file structure", () => {
  it("api/middleware/error-handler.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/error-handler.ts"))).toBe(true);
  });

  it("api/middleware/not-found.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/not-found.ts"))).toBe(true);
  });
});

// --- Error handler module ---
describe("ms-a0-5-health-error: error-handler.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/error-handler.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports errorHandler function", () => {
    expect(content).toMatch(/export\s+(function\s+errorHandler|{[^}]*errorHandler)/);
  });

  it("has 4 parameters (Express error middleware requirement)", () => {
    expect(content).toMatch(/err.*req.*res.*next/);
  });

  it("returns safe 500 message (no stack trace)", () => {
    expect(content).toMatch(/Internal server error/);
  });

  it("supports custom statusCode on Error", () => {
    expect(content).toMatch(/statusCode/);
  });

  it("logs error as structured JSON", () => {
    expect(content).toMatch(/JSON\.stringify|logger\.error/);
  });

  it("sets response status from error statusCode", () => {
    expect(content).toMatch(/res\.status\s*\(/);
  });
});

// --- Not found handler ---
describe("ms-a0-5-health-error: not-found.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/not-found.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports notFoundHandler function", () => {
    expect(content).toMatch(/export\s+(function\s+notFoundHandler|{[^}]*notFoundHandler)/);
  });

  it("returns 404 status", () => {
    expect(content).toMatch(/404/);
  });

  it("returns JSON with error message", () => {
    expect(content).toMatch(/Not found/i);
  });
});

// --- Server integration ---
describe("ms-a0-5-health-error: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports errorHandler from middleware", () => {
    expect(content).toMatch(/import.*errorHandler.*from/);
  });

  it("imports notFoundHandler from middleware", () => {
    expect(content).toMatch(/import.*notFoundHandler.*from/);
  });

  it("registers notFoundHandler with app.use", () => {
    expect(content).toMatch(/app\.use\s*\(\s*notFoundHandler\s*\)/);
  });

  it("registers errorHandler with app.use", () => {
    expect(content).toMatch(/app\.use\s*\(\s*errorHandler\s*\)/);
  });
});
