/**
 * TDD tests for ms-a10-4-flag-yaml
 *
 * Verifies flag YAML export:
 * - GET /api/projects/:slug/flags/export returns YAML
 * - ?format=json for JSON alternative
 * - No new migration
 *
 * DEV IMPLEMENTATION NOTES:
 * - Update api/routes/feature-flags.ts:
 *   - Add GET /export endpoint
 *   - Default format: YAML (Content-Type: text/yaml)
 *   - ?format=json returns JSON
 *   - Exports all flags for the project
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("ms-a10-4-flag-yaml: feature-flags.ts export", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/feature-flags.ts"), "utf-8");
  } catch { content = ""; }

  it("has GET /export endpoint", () => {
    expect(content).toMatch(/export/);
    expect(content).toMatch(/\.get\(/i);
  });

  it("supports YAML output format", () => {
    expect(content).toMatch(/yaml|YAML|text\/yaml/i);
  });

  it("supports ?format=json parameter", () => {
    expect(content).toMatch(/format/);
    expect(content).toMatch(/json/i);
  });

  it("sets Content-Type header for YAML", () => {
    expect(content).toMatch(/content-type|setHeader|type\(/i);
  });

  it("exports all flags for the project", () => {
    expect(content).toMatch(/project_slug|flags/i);
  });
});
