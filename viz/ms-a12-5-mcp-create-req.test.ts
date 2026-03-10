/**
 * TDD tests for ms-a12-5-mcp-create-req
 *
 * Verifies mindspace_create_requirement MCP tool:
 * - Tool file exists (createRequirement.ts in src/tools/mindspace/)
 * - Registered in tool index
 * - POST to requirements API with req_id_human + title
 * - Status/priority enum validation
 * - 409 duplicate handling
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create src/tools/mindspace/createRequirement.ts:
 *   - Export tool with name "mindspace_create_requirement"
 *   - Input: { project_slug (req), req_id_human (req), title (req), description,
 *     status (draft/active/deprecated, default draft), priority (low/medium/high/critical, default medium) }
 *   - POST /api/projects/:slug/requirements
 *   - Handle 409 for duplicate req_id_human
 * - Update src/tools/index.ts: register tool
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a12-5-mcp-create-req: file structure", () => {
  it("createRequirement.ts exists in src/tools/mindspace/", () => {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/createRequirement.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/create-requirement.ts"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });
});

// --- Tool implementation ---
describe("ms-a12-5-mcp-create-req: createRequirement.ts", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "src/tools/mindspace/createRequirement.ts"),
      resolve(PROJECT_ROOT, "src/tools/mindspace/create-requirement.ts"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("defines tool name mindspace_create_requirement", () => {
    expect(content).toMatch(/mindspace_create_requirement/);
  });

  it("requires project_slug input", () => {
    expect(content).toMatch(/project_slug/);
  });

  it("requires req_id_human input", () => {
    expect(content).toMatch(/req_id_human/);
  });

  it("requires title input", () => {
    expect(content).toMatch(/title/);
  });

  it("accepts status with enum (draft, active, deprecated)", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/draft/);
  });

  it("accepts priority with enum (low, medium, high, critical)", () => {
    expect(content).toMatch(/priority/);
    expect(content).toMatch(/medium|low|high|critical/);
  });

  it("handles 409 duplicate req_id_human", () => {
    expect(content).toMatch(/409|duplicate|conflict/i);
  });

  it("POSTs to requirements API endpoint", () => {
    expect(content).toMatch(/\/requirements/);
    expect(content).toMatch(/POST|fetch|http/i);
  });

  it("uses MINDSPACE_API_URL env var", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });
});

// --- Tool registration ---
describe("ms-a12-5-mcp-create-req: index.ts registration", () => {
  let content: string;
  try {
    content = readFileSync(resolve(PROJECT_ROOT, "src/tools/index.ts"), "utf-8");
  } catch { content = ""; }

  it("imports createRequirement tool", () => {
    expect(content).toMatch(/createRequirement|create-requirement|mindspace_create_requirement/i);
  });
});
