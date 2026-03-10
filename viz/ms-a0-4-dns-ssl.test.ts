/**
 * TDD tests for ms-a0-4-dns-ssl
 *
 * Verifies HTTPS/SSL configuration for mindspace.xpollination.earth:
 * - Updated nginx config with SSL (port 443), HTTP→HTTPS redirect
 * - Let's Encrypt certificate paths
 * - ACME challenge passthrough for cert renewal
 * - deploy/ssl/setup-ssl.sh script for certbot
 * - Preserves all ms-a0-3 features (rate limiting, SSE, WebSocket)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update deploy/nginx/mindspace.xpollination.earth:
 *   - Add server block listening on 443 ssl
 *   - Add ssl_certificate and ssl_certificate_key paths (/etc/letsencrypt/live/...)
 *   - Add HTTP→HTTPS redirect (return 301 https://$host$request_uri)
 *   - Add ACME challenge location (/.well-known/acme-challenge/)
 *   - Preserve all proxy_pass, rate limiting, SSE/WebSocket config from ms-a0-3
 * - Create deploy/ssl/setup-ssl.sh with certbot instructions
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a0-4-dns-ssl: file structure", () => {
  it("deploy/ssl/setup-ssl.sh exists", () => {
    expect(existsSync(resolve(PROJECT_ROOT, "deploy/ssl/setup-ssl.sh"))).toBe(true);
  });
});

// --- Nginx HTTPS config ---
describe("ms-a0-4-dns-ssl: nginx config HTTPS", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "deploy/nginx/mindspace.xpollination.earth"), "utf-8");
  } catch {
    content = "";
  }

  it("listens on port 443 with ssl", () => {
    expect(content).toMatch(/listen\s+443\s+ssl/);
  });

  it("has ssl_certificate path", () => {
    expect(content).toMatch(/ssl_certificate\s+/);
  });

  it("references letsencrypt certificate path", () => {
    expect(content).toMatch(/letsencrypt.*mindspace/);
  });

  it("has ssl_certificate_key path", () => {
    expect(content).toMatch(/ssl_certificate_key\s+/);
  });

  it("has HTTP to HTTPS redirect", () => {
    expect(content).toMatch(/return\s+301\s+https/);
  });

  it("has ACME challenge location for cert renewal", () => {
    expect(content).toMatch(/\.well-known\/acme-challenge/);
  });

  it("preserves proxy_pass to port 3100", () => {
    expect(content).toMatch(/proxy_pass\s+http:\/\/127\.0\.0\.1:3100/);
  });

  it("preserves WebSocket upgrade headers", () => {
    expect(content).toMatch(/proxy_set_header\s+Upgrade/);
  });

  it("preserves proxy_buffering off for SSE", () => {
    expect(content).toMatch(/proxy_buffering\s+off/);
  });

  it("preserves rate limiting", () => {
    expect(content).toMatch(/limit_req.*burst/);
  });
});

// --- SSL setup script ---
describe("ms-a0-4-dns-ssl: setup-ssl.sh", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "deploy/ssl/setup-ssl.sh"), "utf-8");
  } catch {
    content = "";
  }

  it("is a bash script", () => {
    expect(content).toMatch(/^#!\/bin\/bash/);
  });

  it("references certbot", () => {
    expect(content).toMatch(/certbot/);
  });

  it("references mindspace.xpollination.earth domain", () => {
    expect(content).toMatch(/mindspace\.xpollination\.earth/);
  });

  it("uses nginx plugin or webroot", () => {
    expect(content).toMatch(/--nginx|--webroot/);
  });
});
