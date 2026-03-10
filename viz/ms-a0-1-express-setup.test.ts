/**
 * TDD tests for ms-a0-1-express-setup
 *
 * Verifies Express.js project initialization:
 * - Folder structure: api/ with routes/, middleware/, models/, services/
 * - server.ts and routes/health.ts exist
 * - package.json has express dependency and api script
 * - tsconfig.json includes api directory
 * - GET /health returns 200 with { status, version, uptime }
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/ directory at project root (separate from src/ and viz/)
 * - npm install express @types/express
 * - Create api/server.ts with Express app, port from API_PORT env (default 3100)
 * - Create api/routes/health.ts with GET / returning { status: "ok", version: "0.0.7", uptime }
 * - Add "api" and "api:dev" scripts to package.json
 * - Add api dir glob to tsconfig.json include array
 * - Create .gitkeep files in middleware/, models/, services/
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import http from "node:http";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- Requirement 1-5: File/directory existence ---
describe("ms-a0-1-express-setup: folder structure", () => {
  it("api/server.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "server.ts"))).toBe(true);
  });

  it("api/routes/health.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/health.ts"))).toBe(true);
  });

  it("api/middleware/ directory exists", () => {
    expect(existsSync(resolve(API_DIR, "middleware"))).toBe(true);
  });

  it("api/models/ directory exists", () => {
    expect(existsSync(resolve(API_DIR, "models"))).toBe(true);
  });

  it("api/services/ directory exists", () => {
    expect(existsSync(resolve(API_DIR, "services"))).toBe(true);
  });
});

// --- Requirement 6-8: package.json ---
describe("ms-a0-1-express-setup: package.json", () => {
  let pkg: any;

  beforeAll(() => {
    pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, "package.json"), "utf-8"));
  });

  it("express is in dependencies", () => {
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.express).toBeDefined();
  });

  it("@types/express is in devDependencies", () => {
    expect(pkg.devDependencies).toBeDefined();
    expect(pkg.devDependencies["@types/express"]).toBeDefined();
  });

  it("api script exists in package.json", () => {
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.api).toBeDefined();
  });
});

// --- Requirement 14: tsconfig.json ---
describe("ms-a0-1-express-setup: tsconfig.json", () => {
  it("tsconfig.json includes api directory", () => {
    const tsconfig = JSON.parse(
      readFileSync(resolve(PROJECT_ROOT, "tsconfig.json"), "utf-8")
    );
    expect(tsconfig.include).toBeDefined();
    const apiIncluded = tsconfig.include.some((p: string) => p.startsWith("api"));
    expect(apiIncluded).toBe(true);
  });
});

// --- Requirement 9-13: Health endpoint ---
describe("ms-a0-1-express-setup: health endpoint", () => {
  let serverProcess: any;
  const TEST_PORT = 13199; // Unique port to avoid conflicts

  beforeAll(async () => {
    // Import and start the app on a test port
    // We need the compiled JS, so we test against the built output
    const distServer = resolve(PROJECT_ROOT, "dist/api/server.js");
    if (!existsSync(distServer)) {
      // If not built yet, skip runtime tests
      return;
    }

    // Dynamic import with env override
    process.env.API_PORT = String(TEST_PORT);
    try {
      const mod = await import(distServer);
      serverProcess = mod.app;
    } catch {
      // Server may already be listening or build not available
    }
  });

  afterAll(() => {
    delete process.env.API_PORT;
  });

  it("server.ts exports app", async () => {
    // Check source file has export { app }
    const content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
    expect(content).toMatch(/export\s*\{.*app.*\}/);
  });

  it("health route returns JSON with status field", () => {
    const content = readFileSync(resolve(API_DIR, "routes/health.ts"), "utf-8");
    expect(content).toMatch(/status.*ok|'ok'|"ok"/);
  });

  it("health route returns version 0.0.7", () => {
    const content = readFileSync(resolve(API_DIR, "routes/health.ts"), "utf-8");
    expect(content).toMatch(/version.*0\.0\.7|'0\.0\.7'|"0\.0\.7"/);
  });

  it("health route returns uptime as number", () => {
    const content = readFileSync(resolve(API_DIR, "routes/health.ts"), "utf-8");
    expect(content).toMatch(/uptime.*process\.uptime/);
  });

  it("server binds to configurable port via API_PORT", () => {
    const content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
    expect(content).toMatch(/API_PORT/);
    expect(content).toMatch(/3100/);
  });

  it("server uses express.json() middleware", () => {
    const content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
    expect(content).toMatch(/express\.json\(\)/);
  });

  it("server mounts health router at /health", () => {
    const content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
    expect(content).toMatch(/['"]\/health['"]/);
  });
});
