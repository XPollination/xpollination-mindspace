/**
 * Gardener Engine Skill Tests (gardener-engine-skill task)
 *
 * Tests that the gardener skill exists, is structured correctly, and that
 * the brain API supports all operations the gardener requires.
 *
 * Acceptance criteria:
 * AC1: Skill runs independently as Layer 2 (manual deep gardening)
 * AC2: PM status can call it with scope=recent depth=shallow (Layer 1)
 * AC3: Task completion can call it with scope=task:slug depth=micro (Layer 3)
 * AC4: dry_run=true reports changes without mutating
 * AC5: All three depths produce correct operations
 *
 * Design: SKILL.md at best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md
 * Three depths (shallow/micro/deep), three scopes (recent/task:slug/full), dry-run flag.
 * Uses brain API: POST /api/v1/memory with full_content, refines, consolidates.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import { think } from "./thoughtspace.js";

const SKILL_PATH = resolve(
  __dirname,
  "../../../../.claude/skills/xpo.claude.mindspace.garden/SKILL.md"
);
const BRAIN_URL = "http://localhost:3200/api/v1/memory";
const HEALTH_URL = "http://localhost:3200/api/v1/health";
const TEST_AGENT_ID = `agent-gardener-test-${Date.now()}`;
const TEST_AGENT_NAME = "GardenerTest";

// Helper: POST to brain API
async function postMemory(body: Record<string, unknown>): Promise<Response> {
  return fetch(BRAIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// --- Pre-check: brain API available ---

describe("Brain API prerequisites", () => {
  it("brain API is healthy", async () => {
    const res = await fetch(HEALTH_URL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.qdrant).toBe(true);
  });
});

// --- AC1 + Structure: Skill file exists with required structure ---

describe("SKILL.md structure", () => {
  it("skill file exists at expected path", () => {
    expect(existsSync(SKILL_PATH)).toBe(true);
  });

  it("skill accepts scope parameter (recent|task:slug|full)", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toContain("scope");
    expect(content).toMatch(/recent/);
    expect(content).toMatch(/task:/);
    expect(content).toMatch(/full/);
  });

  it("skill accepts depth parameter (shallow|micro|deep)", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toContain("depth");
    expect(content).toMatch(/shallow/);
    expect(content).toMatch(/micro/);
    expect(content).toMatch(/deep/);
  });

  it("skill accepts dry_run parameter", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/dry.?run/);
  });

  it("skill documents Layer 1 integration (PM status with recent shallow)", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    // Should mention PM status / Layer 1 invocation pattern
    expect(content).toMatch(/layer.?1|pm.?status|recent.*shallow/);
  });

  it("skill documents Layer 3 integration (task completion with task:slug micro)", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    // Should mention task completion / Layer 3 invocation pattern
    expect(content).toMatch(/layer.?3|task.*completion|task:.*micro/);
  });
});

// --- API dependency: full_content queries ---

describe("API: full_content queries (gardener reads full thoughts)", () => {
  let seedThoughtId: string;

  beforeAll(async () => {
    // Create a test thought the gardener can discover
    const res = await postMemory({
      prompt: "Gardener test thought for full content verification — the gardener engine needs to read complete thought bodies to analyze and categorize them.",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
    });
    const body = (await res.json()) as Record<string, unknown>;
    const sources = ((body as Record<string, unknown>).result as Record<string, unknown>)?.sources as Array<Record<string, unknown>>;
    if (sources && sources.length > 0) {
      seedThoughtId = sources[0].thought_id as string;
    }
  });

  it("query with full_content=true returns full content in sources", async () => {
    const res = await postMemory({
      prompt: "gardener engine full content verification test",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
      full_content: true,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const result = body.result as Record<string, unknown>;
    const sources = result.sources as Array<Record<string, unknown>>;

    // At least one source should have a content field (not just content_preview)
    if (sources && sources.length > 0) {
      const hasContent = sources.some((s) => "content" in s);
      expect(hasContent).toBe(true);
    }
  });
});

// --- API dependency: refine operation ---

describe("API: refine operation (gardener creates refinement thoughts)", () => {
  let thoughtToRefine: string;

  beforeAll(async () => {
    // Create a thought to refine
    const res = await postMemory({
      prompt: "Gardener test original thought for refinement verification — this thought will be refined by the gardener engine during micro-depth operations.",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
    });
    const body = (await res.json()) as Record<string, unknown>;
    const trace = (body as Record<string, unknown>).trace as Record<string, unknown>;
    // The thought was contributed — get its ID from a subsequent query
    const queryRes = await postMemory({
      prompt: "Gardener test original thought for refinement verification",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
    });
    const queryBody = (await queryRes.json()) as Record<string, unknown>;
    const result = queryBody.result as Record<string, unknown>;
    const sources = result.sources as Array<Record<string, unknown>>;
    if (sources && sources.length > 0) {
      thoughtToRefine = sources[0].thought_id as string;
    }
  });

  it("refine creates a refinement thought linked to original", async () => {
    expect(thoughtToRefine).toBeDefined();

    const res = await postMemory({
      prompt: "REFINED: Gardener test original thought — refined with additional analysis showing the gardener engine accurately consolidates knowledge during micro-depth passes.",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
      refines: thoughtToRefine,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const trace = body.trace as Record<string, unknown>;
    expect(trace.thoughts_contributed).toBe(1);
  });
});

// --- API dependency: consolidate operation ---

describe("API: consolidate operation (gardener merges related thoughts)", () => {
  let thoughtIds: string[] = [];

  beforeAll(async () => {
    // Create 2 thoughts directly via think() for reliable IDs
    const [a, b] = await Promise.all([
      think({
        content: "Gardener consolidation test thought A — knowledge management systems require periodic pruning to maintain relevance and signal-to-noise ratio.",
        contributor_id: TEST_AGENT_ID,
        contributor_name: TEST_AGENT_NAME,
        thought_type: "original",
        source_ids: [],
        tags: ["gardener-test"],
      }),
      think({
        content: "Gardener consolidation test thought B — knowledge bases degrade without maintenance; periodic consolidation reduces redundancy and improves retrieval quality.",
        contributor_id: TEST_AGENT_ID,
        contributor_name: TEST_AGENT_NAME,
        thought_type: "original",
        source_ids: [],
        tags: ["gardener-test"],
      }),
    ]);
    thoughtIds = [a.thought_id, b.thought_id];
  });

  it("consolidate merges two thoughts into one", async () => {
    expect(thoughtIds.length).toBeGreaterThanOrEqual(2);

    const res = await postMemory({
      prompt: "CONSOLIDATED: Knowledge management systems require periodic pruning and consolidation to maintain relevance, reduce redundancy, and improve retrieval quality.",
      agent_id: TEST_AGENT_ID,
      agent_name: TEST_AGENT_NAME,
      consolidates: thoughtIds.slice(0, 2),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const trace = body.trace as Record<string, unknown>;
    expect(trace.thoughts_contributed).toBe(1);
  });
});

// --- AC4: dry_run behavior (no mutations) ---
// The SKILL.md must describe dry_run logic. Since it's agent instructions,
// we test that the skill file contains dry_run guards.

describe("AC4: dry_run documentation", () => {
  it("skill documents dry_run=true reporting without mutations", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    // Should contain dry-run logic that skips mutations
    expect(content).toMatch(/dry.?run/);
    // Should mention reporting/listing changes without executing
    expect(content).toMatch(/report|list|skip|without.*mut|no.*mut|would/);
  });
});

// --- AC5: Three depths documented ---

describe("AC5: depth operations", () => {
  it("shallow depth: count, categorize, flag noise, report", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    // Shallow should mention counting/categorizing/flagging
    expect(content).toMatch(/shallow/);
    expect(content).toMatch(/count|categor|flag|report/);
  });

  it("micro depth: adds consolidation + mark intermediates archivable", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/micro/);
    expect(content).toMatch(/consolidat|archiv/);
  });

  it("deep depth: adds domain summaries, duplicate merging, highway curation, superseding", () => {
    const content = readFileSync(SKILL_PATH, "utf-8").toLowerCase();
    expect(content).toMatch(/deep/);
    expect(content).toMatch(/domain.*summar|duplicate.*merg|highway.*curat|supersed/);
  });
});
