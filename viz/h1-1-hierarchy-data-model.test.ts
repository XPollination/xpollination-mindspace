/**
 * TDD tests for h1-1-hierarchy-data-model
 *
 * Verifies missions + capabilities data model:
 * - 002-missions-capabilities.sql: missions table + capabilities table
 * - 003-capability-links.sql: junction tables for requirements + tasks
 * - Correct columns, constraints, foreign keys
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/db/migrations/002-missions-capabilities.sql:
 *   - missions: id UUID, title, description, status CHECK (draft/active/complete/cancelled),
 *     created_at, updated_at
 *   - capabilities: id UUID, mission_id FK→missions(id), title, description,
 *     status CHECK (draft/active/blocked/complete/cancelled), dependency_ids JSON,
 *     sort_order INTEGER, created_at, updated_at
 * - Create api/db/migrations/003-capability-links.sql:
 *   - capability_requirements: capability_id FK, requirement_ref TEXT
 *   - capability_tasks: capability_id FK, task_slug TEXT
 *   - Both with composite primary keys
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const MIGRATIONS_DIR = resolve(PROJECT_ROOT, "api/db/migrations");

// --- File structure ---
describe("h1-1-hierarchy-data-model: file structure", () => {
  it("002-missions-capabilities.sql exists", () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, "002-missions-capabilities.sql"))).toBe(true);
  });

  it("003-capability-links.sql exists", () => {
    expect(existsSync(resolve(MIGRATIONS_DIR, "003-capability-links.sql"))).toBe(true);
  });
});

// --- 002-missions-capabilities.sql ---
describe("h1-1-hierarchy-data-model: missions table", () => {
  let content: string;
  try {
    content = readFileSync(resolve(MIGRATIONS_DIR, "002-missions-capabilities.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates missions table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*missions/i);
  });

  it("missions has id column", () => {
    expect(content).toMatch(/\bid\b/i);
  });

  it("missions has title column", () => {
    expect(content).toMatch(/\btitle\b/i);
  });

  it("missions has description column", () => {
    expect(content).toMatch(/\bdescription\b/i);
  });

  it("missions has status with CHECK constraint", () => {
    expect(content).toMatch(/status/i);
    expect(content).toMatch(/CHECK/i);
  });

  it("missions status allows draft/active/complete/cancelled", () => {
    expect(content).toMatch(/draft/i);
    expect(content).toMatch(/active/i);
    expect(content).toMatch(/complete/i);
    expect(content).toMatch(/cancelled/i);
  });

  it("missions has timestamps", () => {
    expect(content).toMatch(/created_at/i);
    expect(content).toMatch(/updated_at/i);
  });
});

describe("h1-1-hierarchy-data-model: capabilities table", () => {
  let content: string;
  try {
    content = readFileSync(resolve(MIGRATIONS_DIR, "002-missions-capabilities.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates capabilities table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*capabilities/i);
  });

  it("capabilities has mission_id foreign key", () => {
    expect(content).toMatch(/mission_id/i);
  });

  it("capabilities references missions table", () => {
    expect(content).toMatch(/REFERENCES\s+missions/i);
  });

  it("capabilities has dependency_ids JSON column", () => {
    expect(content).toMatch(/dependency_ids/i);
  });

  it("capabilities has sort_order column", () => {
    expect(content).toMatch(/sort_order/i);
  });

  it("capabilities status includes blocked", () => {
    expect(content).toMatch(/blocked/i);
  });
});

// --- 003-capability-links.sql ---
describe("h1-1-hierarchy-data-model: junction tables", () => {
  let content: string;
  try {
    content = readFileSync(resolve(MIGRATIONS_DIR, "003-capability-links.sql"), "utf-8");
  } catch {
    content = "";
  }

  it("creates capability_requirements table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*capability_requirements/i);
  });

  it("capability_requirements has requirement_ref column", () => {
    expect(content).toMatch(/requirement_ref/i);
  });

  it("creates capability_tasks table", () => {
    expect(content).toMatch(/CREATE\s+TABLE.*capability_tasks/i);
  });

  it("capability_tasks has task_slug column", () => {
    expect(content).toMatch(/task_slug/i);
  });

  it("junction tables reference capability_id", () => {
    expect(content).toMatch(/capability_id/i);
  });
});
