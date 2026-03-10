/**
 * TDD tests for ms-a0-6-logging
 *
 * Verifies structured JSON logging framework:
 * - api/lib/logger.ts with pino instance
 * - api/middleware/request-logger.ts with pino-http
 * - LOG_LEVEL env var support
 * - Request ID generation/passthrough
 * - Minimal serializers (no body logging)
 * - Server integration
 *
 * DEV IMPLEMENTATION NOTES:
 * - npm install pino pino-http; npm install -D @types/pino-http
 * - Create api/lib/logger.ts with pino logger, LOG_LEVEL env, isoTime
 * - Create api/middleware/request-logger.ts with pinoHttp, genReqId, serializers
 * - Modify api/server.ts: register requestLogger before routes, use logger for startup
 * - Modify api/middleware/error-handler.ts: replace console.error with logger.error
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a0-6-logging: file structure", () => {
  it("api/lib/logger.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "lib/logger.ts"))).toBe(true);
  });

  it("api/middleware/request-logger.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware/request-logger.ts"))).toBe(true);
  });
});

// --- Logger module ---
describe("ms-a0-6-logging: logger.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "lib/logger.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports pino", () => {
    expect(content).toMatch(/import.*pino.*from\s+['"]pino['"]/);
  });

  it("exports logger instance", () => {
    expect(content).toMatch(/export\s+(const|let)\s+logger/);
  });

  it("reads LOG_LEVEL from environment", () => {
    expect(content).toMatch(/LOG_LEVEL/);
  });

  it("defaults to debug in non-production", () => {
    expect(content).toMatch(/debug/);
  });

  it("defaults to info in production", () => {
    expect(content).toMatch(/production.*info|info.*production/);
  });

  it("uses ISO timestamp format", () => {
    expect(content).toMatch(/isoTime/);
  });
});

// --- Request logger middleware ---
describe("ms-a0-6-logging: request-logger.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/request-logger.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports pino-http", () => {
    expect(content).toMatch(/import.*from\s+['"]pino-http['"]/);
  });

  it("imports logger from lib/logger", () => {
    expect(content).toMatch(/import.*logger.*from/);
  });

  it("exports requestLogger", () => {
    expect(content).toMatch(/export\s+(const|let)\s+requestLogger/);
  });

  it("generates request ID with x-request-id passthrough", () => {
    expect(content).toMatch(/x-request-id/);
  });

  it("uses custom serializers", () => {
    expect(content).toMatch(/serializers/);
  });

  it("logs method in request serializer", () => {
    expect(content).toMatch(/method/);
  });

  it("logs url in request serializer", () => {
    expect(content).toMatch(/url/);
  });

  it("logs statusCode in response serializer", () => {
    expect(content).toMatch(/statusCode/);
  });
});

// --- Dependencies ---
describe("ms-a0-6-logging: package.json dependencies", () => {
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  } catch {
    pkg = {};
  }

  it("pino is in dependencies", () => {
    expect(pkg.dependencies?.pino).toBeDefined();
  });

  it("pino-http is in dependencies", () => {
    expect(pkg.dependencies?.["pino-http"]).toBeDefined();
  });
});

// --- Server integration ---
describe("ms-a0-6-logging: server integration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports requestLogger", () => {
    expect(content).toMatch(/import.*requestLogger.*from/);
  });

  it("registers requestLogger with app.use", () => {
    expect(content).toMatch(/app\.use\s*\(\s*requestLogger\s*\)/);
  });

  it("imports logger for startup logging", () => {
    expect(content).toMatch(/import.*logger.*from/);
  });

  it("uses logger.info for startup message", () => {
    expect(content).toMatch(/logger\.info/);
  });
});

// --- Error handler updated ---
describe("ms-a0-6-logging: error handler uses logger", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "middleware/error-handler.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("error handler imports logger", () => {
    expect(content).toMatch(/import.*logger.*from/);
  });

  it("error handler uses logger.error instead of console.error", () => {
    expect(content).toMatch(/logger\.error/);
  });
});
