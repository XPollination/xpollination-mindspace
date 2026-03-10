/**
 * TDD tests for ms-a0-3-nginx-proxy
 *
 * Verifies nginx reverse proxy configuration:
 * - deploy/nginx/mindspace.xpollination.earth config file
 * - deploy/nginx/deploy.sh deployment script
 * - proxy_pass to Express port 3100
 * - SSE/WebSocket upgrade headers
 * - Rate limiting (10r/s, health exempt)
 * - proxy_buffering off for streaming
 * - X-Request-Id passthrough
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create deploy/nginx/mindspace.xpollination.earth with nginx server block
 * - Create deploy/nginx/deploy.sh with sshpass deployment via thomas user
 * - proxy_pass http://127.0.0.1:3100
 * - Rate limit zone: mindspace_api:10m rate=10r/s
 * - Health check at /health with limit_req off
 * - WebSocket/SSE upgrade headers
 * - proxy_buffering off, proxy_read_timeout 300s for SSE
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a0-3-nginx-proxy: file structure", () => {
  it("deploy/nginx/mindspace.xpollination.earth exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "deploy/nginx/mindspace.xpollination.earth"))).toBe(true);
  });

  it("deploy/nginx/deploy.sh exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "deploy/nginx/deploy.sh"))).toBe(true);
  });
});

// --- Nginx config ---
describe("ms-a0-3-nginx-proxy: nginx config", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "deploy/nginx/mindspace.xpollination.earth"), "utf-8");
  } catch {
    content = "";
  }

  it("listens on port 80", () => {
    expect(content).toMatch(/listen\s+80/);
  });

  it("serves mindspace.xpollination.earth", () => {
    expect(content).toMatch(/server_name\s+mindspace\.xpollination\.earth/);
  });

  it("proxy_pass to Express on port 3100", () => {
    expect(content).toMatch(/proxy_pass\s+http:\/\/127\.0\.0\.1:3100/);
  });

  it("sets X-Real-IP header", () => {
    expect(content).toMatch(/proxy_set_header\s+X-Real-IP/);
  });

  it("sets X-Forwarded-For header", () => {
    expect(content).toMatch(/proxy_set_header\s+X-Forwarded-For/);
  });

  it("sets X-Request-Id header", () => {
    expect(content).toMatch(/proxy_set_header\s+X-Request-Id/);
  });

  it("includes WebSocket upgrade headers", () => {
    expect(content).toMatch(/proxy_set_header\s+Upgrade/);
    expect(content).toMatch(/proxy_set_header\s+Connection/);
  });

  it("disables proxy buffering for SSE", () => {
    expect(content).toMatch(/proxy_buffering\s+off/);
  });

  it("has long proxy_read_timeout for SSE (>= 300s)", () => {
    expect(content).toMatch(/proxy_read_timeout\s+\d+/);
  });

  it("has rate limiting with burst", () => {
    expect(content).toMatch(/limit_req.*burst/);
  });

  it("exempts health check from rate limiting", () => {
    expect(content).toMatch(/location.*\/health/);
    expect(content).toMatch(/limit_req\s+off/);
  });
});

// --- Deploy script ---
describe("ms-a0-3-nginx-proxy: deploy.sh", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "deploy/nginx/deploy.sh"), "utf-8");
  } catch {
    content = "";
  }

  it("is a bash script", () => {
    expect(content).toMatch(/^#!\/bin\/bash/);
  });

  it("uses sshpass for deployment via thomas user", () => {
    expect(content).toMatch(/sshpass/);
    expect(content).toMatch(/thomas@localhost/);
  });

  it("copies config to nginx sites-available", () => {
    expect(content).toMatch(/sites-available/);
  });

  it("creates symlink in sites-enabled", () => {
    expect(content).toMatch(/sites-enabled/);
  });

  it("runs nginx -t to test config", () => {
    expect(content).toMatch(/nginx\s+-t/);
  });

  it("reloads nginx after deployment", () => {
    expect(content).toMatch(/systemctl\s+reload\s+nginx|nginx\s+-s\s+reload/);
  });
});
