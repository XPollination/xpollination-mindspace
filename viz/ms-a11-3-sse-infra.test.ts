/**
 * TDD tests for ms-a11-3-sse-infra
 *
 * Verifies SSE stream infrastructure:
 * - api/lib/sse-manager.ts exists with addConnection, removeConnection, sendToAgent, broadcast
 * - api/routes/a2a-stream.ts exists with SSE endpoint
 * - SSE headers: Content-Type text/event-stream, Cache-Control no-cache, Connection keep-alive
 * - Heartbeat interval setup (30s)
 * - One connection per agent (reconnect replaces)
 * - Cleanup on disconnect
 * - sendToAgent returns boolean
 * - broadcast helper
 * - getConnectedAgents and getConnectionCount exports
 * - Health endpoint includes sse_connections
 * - SSE message format: event + data lines
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/lib/sse-manager.ts with exports: addConnection, removeConnection, sendToAgent, broadcast, getConnectedAgents, getConnectionCount
 * - Create api/routes/a2a-stream.ts with GET /:agent_id SSE endpoint
 * - Modify api/server.ts: mount a2aStreamRouter at /a2a/stream
 * - Modify api/routes/health.ts: include sse_connections count
 * - Use SSE comment (: heartbeat) for keepalive, not event
 * - One connection per agent — reconnect replaces old connection
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

// --- File structure ---
describe("ms-a11-3-sse-infra: file structure", () => {
  it("api/lib/sse-manager.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "lib/sse-manager.ts"))).toBe(true);
  });

  it("api/routes/a2a-stream.ts exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/a2a-stream.ts"))).toBe(true);
  });
});

// --- SSE Manager module ---
describe("ms-a11-3-sse-infra: sse-manager module", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "lib/sse-manager.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("exports addConnection function", () => {
    expect(content).toMatch(/export\s+(function\s+addConnection|{[^}]*addConnection)/);
  });

  it("exports removeConnection function", () => {
    expect(content).toMatch(/export\s+(function\s+removeConnection|{[^}]*removeConnection)/);
  });

  it("exports sendToAgent function", () => {
    expect(content).toMatch(/export\s+(function\s+sendToAgent|{[^}]*sendToAgent)/);
  });

  it("exports broadcast function", () => {
    expect(content).toMatch(/export\s+(function\s+broadcast|{[^}]*broadcast)/);
  });

  it("exports getConnectedAgents function", () => {
    expect(content).toMatch(/export\s+(function\s+getConnectedAgents|{[^}]*getConnectedAgents)/);
  });

  it("exports getConnectionCount function", () => {
    expect(content).toMatch(/export\s+(function\s+getConnectionCount|{[^}]*getConnectionCount)/);
  });

  it("sets Content-Type to text/event-stream", () => {
    expect(content).toMatch(/text\/event-stream/);
  });

  it("sets Cache-Control to no-cache", () => {
    expect(content).toMatch(/no-cache/);
  });

  it("sets Connection to keep-alive", () => {
    expect(content).toMatch(/keep-alive/);
  });

  it("sends connected event on connection open", () => {
    expect(content).toMatch(/event:\s*connected/);
  });

  it("sets up heartbeat interval at 30s", () => {
    expect(content).toMatch(/30[_,]?000/);
  });

  it("uses SSE comment format for heartbeat (colon prefix)", () => {
    expect(content).toMatch(/:\s*heartbeat/);
  });

  it("uses Map for connection storage", () => {
    expect(content).toMatch(/new\s+Map/);
  });

  it("removes existing connection on reconnect (one per agent)", () => {
    // addConnection should call removeConnection first
    expect(content).toMatch(/removeConnection\s*\(/);
  });

  it("clears heartbeat interval on removal", () => {
    expect(content).toMatch(/clearInterval/);
  });

  it("sendToAgent returns boolean", () => {
    expect(content).toMatch(/return\s+(true|false)/);
  });

  it("uses SSE message format: event + data lines", () => {
    expect(content).toMatch(/event:\s*\$\{/);
    expect(content).toMatch(/data:\s*\$\{/);
  });
});

// --- A2A stream route ---
describe("ms-a11-3-sse-infra: a2a-stream route", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "routes/a2a-stream.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports addConnection and removeConnection from sse-manager", () => {
    expect(content).toMatch(/import.*addConnection.*from/);
    expect(content).toMatch(/removeConnection/);
  });

  it("defines GET /:agent_id route", () => {
    expect(content).toMatch(/:agent_id/);
  });

  it("calls addConnection with agent_id and response", () => {
    expect(content).toMatch(/addConnection\s*\(/);
  });

  it("handles client disconnect via req.on close", () => {
    expect(content).toMatch(/req\.on\s*\(\s*['"]close['"]/);
  });

  it("exports a2aStreamRouter", () => {
    expect(content).toMatch(/export.*a2aStreamRouter/);
  });
});

// --- Server integration ---
describe("ms-a11-3-sse-infra: server integration", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "server.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports a2aStreamRouter", () => {
    expect(content).toMatch(/import.*a2aStreamRouter.*from/);
  });

  it("mounts a2a stream route at /a2a/stream", () => {
    expect(content).toMatch(/['"]\/a2a\/stream['"]/);
  });
});

// --- Health endpoint includes SSE connections ---
describe("ms-a11-3-sse-infra: health endpoint", () => {
  let content: string;

  try {
    content = readFileSync(resolve(API_DIR, "routes/health.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports getConnectionCount from sse-manager", () => {
    expect(content).toMatch(/import.*getConnectionCount.*from/);
  });

  it("includes sse_connections in response", () => {
    expect(content).toMatch(/sse_connections/);
  });
});
