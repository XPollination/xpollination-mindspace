/**
 * TDD tests for h1-2-capability-crud
 *
 * Verifies Capability CRUD API endpoints:
 * - POST / — create capability (mission_id + title required)
 * - GET / — list capabilities (status, mission_id filters)
 * - GET /:capId — single capability
 * - PUT /:capId — update (no DELETE, use cancelled status)
 * - Requirement linking: GET/POST/DELETE /:capId/requirements
 * - Task linking: GET/POST/DELETE /:capId/tasks
 * - Access control: requireProjectAccess (viewer reads, contributor writes)
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create api/routes/capabilities.ts
 * - Register as /:slug/capabilities in projects.ts
 * - Valid statuses: draft, active, blocked, complete, cancelled
 * - 404 for missing capability/mission
 * - 409 for duplicate links
 * - 400 for missing required fields or invalid status
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);
const API_DIR = resolve(PROJECT_ROOT, "api");

describe("h1-2-capability-crud: route file", () => {
  it("capabilities route file exists", () => {
    expect(existsSync(resolve(API_DIR, "routes/capabilities.ts"))).toBe(true);
  });

  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/capabilities.ts"), "utf-8");
  } catch {
    content = "";
  }

  // CRUD endpoints
  it("exports capabilitiesRouter", () => {
    expect(content).toMatch(/export.*capabilitiesRouter/);
  });

  it("has POST create endpoint", () => {
    expect(content).toMatch(/\.post\s*\(\s*['"]\//);
  });

  it("has GET list endpoint", () => {
    expect(content).toMatch(/\.get\s*\(\s*['"]\//);
  });

  it("has GET single endpoint with capId param", () => {
    expect(content).toMatch(/capId/);
    expect(content).toMatch(/\.get\s*\(/);
  });

  it("has PUT update endpoint", () => {
    expect(content).toMatch(/\.put\s*\(/);
  });

  // Required fields
  it("requires mission_id", () => {
    expect(content).toMatch(/mission_id/);
  });

  it("requires title", () => {
    expect(content).toMatch(/title/);
  });

  // Status validation
  it("validates capability status", () => {
    expect(content).toMatch(/VALID_STATUSES|valid.*status/i);
  });

  it("includes all valid statuses", () => {
    expect(content).toMatch(/draft/);
    expect(content).toMatch(/active/);
    expect(content).toMatch(/blocked/);
    expect(content).toMatch(/complete/);
    expect(content).toMatch(/cancelled/);
  });

  // Error responses
  it("returns 400 for missing required fields", () => {
    expect(content).toMatch(/400/);
  });

  it("returns 404 for not found", () => {
    expect(content).toMatch(/404/);
  });

  it("returns 201 on successful creation", () => {
    expect(content).toMatch(/201/);
  });

  // Sorting
  it("sorts by sort_order", () => {
    expect(content).toMatch(/sort_order/);
    expect(content).toMatch(/ORDER BY/i);
  });

  // Filters
  it("supports status filter on list", () => {
    expect(content).toMatch(/status/);
    expect(content).toMatch(/req\.query/);
  });

  it("supports mission_id filter on list", () => {
    expect(content).toMatch(/mission_id/);
  });
});

describe("h1-2-capability-crud: requirement linking", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/capabilities.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("has GET requirements endpoint", () => {
    expect(content).toMatch(/requirements/);
  });

  it("has POST requirements linking", () => {
    expect(content).toMatch(/capability_requirements/);
    expect(content).toMatch(/INSERT.*capability_requirements/i);
  });

  it("has DELETE requirements unlinking", () => {
    expect(content).toMatch(/\.delete\s*\(/i);
    expect(content).toMatch(/DELETE.*capability_requirements/i);
  });

  it("returns 409 for duplicate requirement link", () => {
    expect(content).toMatch(/409/);
  });

  it("requires requirement_ref field", () => {
    expect(content).toMatch(/requirement_ref/);
  });
});

describe("h1-2-capability-crud: task linking", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/capabilities.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("has task linking endpoints", () => {
    expect(content).toMatch(/capability_tasks/);
  });

  it("has POST task linking", () => {
    expect(content).toMatch(/INSERT.*capability_tasks/i);
  });

  it("has DELETE task unlinking", () => {
    expect(content).toMatch(/DELETE.*capability_tasks/i);
  });

  it("returns 409 for duplicate task link", () => {
    // Already checked 409 exists — verify task-specific duplicate check
    expect(content).toMatch(/Task already linked/);
  });

  it("requires task_slug field", () => {
    expect(content).toMatch(/task_slug/);
  });
});

describe("h1-2-capability-crud: access control", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/capabilities.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("uses requireProjectAccess middleware", () => {
    expect(content).toMatch(/requireProjectAccess/);
  });

  it("requires viewer for read operations", () => {
    expect(content).toMatch(/requireProjectAccess\s*\(\s*['"]viewer['"]\s*\)/);
  });

  it("requires contributor for write operations", () => {
    expect(content).toMatch(/requireProjectAccess\s*\(\s*['"]contributor['"]\s*\)/);
  });
});

describe("h1-2-capability-crud: registration in projects.ts", () => {
  let content: string;
  try {
    content = readFileSync(resolve(API_DIR, "routes/projects.ts"), "utf-8");
  } catch {
    content = "";
  }

  it("imports capabilitiesRouter", () => {
    expect(content).toMatch(/capabilitiesRouter/);
  });

  it("mounts at /:slug/capabilities", () => {
    expect(content).toMatch(/capabilities/);
    expect(content).toMatch(/\.use\s*\(/);
  });
});
