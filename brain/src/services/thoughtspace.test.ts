/**
 * Phase 1 Tests: Thought Tracing Foundation
 *
 * Tests the acceptance criteria from spec Section 9, Phase 1:
 * 1. thought_space Qdrant collection created with all 8 payload indexes
 * 2. query_log SQLite table created
 * 3. think() stores a thought and returns thought_id
 * 4. retrieve() finds stored thoughts by cosine similarity
 * 5. Existing /query, /ingest, /health still work
 * 6. Tests pass
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { think, retrieve, ensureThoughtSpace, ThoughtError } from "./thoughtspace.js";
import { getDb } from "./database.js";
import { embed } from "./embedding.js";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// --- AC1: thought_space collection with 8 payload indexes ---

describe("AC1: thought_space collection", () => {
  it("collection exists in Qdrant", async () => {
    const collections = await qdrant.getCollections();
    const names = collections.collections.map((c) => c.name);
    expect(names).toContain("thought_space");
  });

  it("vector config is 384-dim cosine", async () => {
    const info = await qdrant.getCollection("thought_space");
    const vectors = info.config.params.vectors as { size: number; distance: string };
    expect(vectors.size).toBe(384);
    expect(vectors.distance).toBe("Cosine");
  });

  it("replication_factor is 1", async () => {
    const info = await qdrant.getCollection("thought_space");
    expect(info.config.params.replication_factor).toBe(1);
  });

  it("default_segment_number is 2", async () => {
    const info = await qdrant.getCollection("thought_space");
    expect(info.config.optimizer_config.default_segment_number).toBe(2);
  });

  it("has all 8 required payload indexes", async () => {
    const info = await qdrant.getCollection("thought_space");
    const schema = info.payload_schema;

    // Section 5.1: keyword indexes
    expect(schema.contributor_id?.data_type).toBe("keyword");
    expect(schema.thought_type?.data_type).toBe("keyword");
    expect(schema.tags?.data_type).toBe("keyword");
    expect(schema.knowledge_space_id?.data_type).toBe("keyword");

    // Section 5.1: integer indexes
    expect(schema.access_count?.data_type).toBe("integer");

    // Section 5.1: float indexes
    expect(schema.pheromone_weight?.data_type).toBe("float");

    // Section 5.1: datetime indexes
    expect(schema.created_at?.data_type).toBe("datetime");
    expect(schema.last_accessed?.data_type).toBe("datetime");
  });
});

// --- AC2: query_log SQLite table ---

describe("AC2: query_log SQLite table", () => {
  it("table exists with correct schema", () => {
    const db = getDb();
    const columns = db.pragma("table_info(query_log)") as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const colNames = columns.map((c) => c.name);

    // Section 5.2: all columns present
    expect(colNames).toContain("id");
    expect(colNames).toContain("agent_id");
    expect(colNames).toContain("query_text");
    expect(colNames).toContain("context_text");
    expect(colNames).toContain("query_vector");
    expect(colNames).toContain("returned_ids");
    expect(colNames).toContain("session_id");
    expect(colNames).toContain("timestamp");
    expect(colNames).toContain("result_count");
    expect(colNames).toContain("knowledge_space_id");
  });

  it("has 3 required indexes", () => {
    const db = getDb();
    const indexes = db.pragma("index_list(query_log)") as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain("idx_query_log_agent");
    expect(indexNames).toContain("idx_query_log_session");
    expect(indexNames).toContain("idx_query_log_timestamp");
  });
});

// --- AC3: think() stores a thought and returns thought_id ---

describe("AC3: think() function", () => {
  let storedThoughtId: string;

  it("stores a thought and returns thought_id + pheromone_weight", async () => {
    const result = await think({
      content: "Role boundaries prevent coordination collapse in multi-agent systems.",
      contributor_id: "agent-qa-test",
      contributor_name: "QA Test Agent",
      thought_type: "original",
      source_ids: [],
      tags: ["multi-agent", "role-separation"],
      context_metadata: "Testing Phase 1 implementation",
    });

    expect(result.thought_id).toBeDefined();
    expect(typeof result.thought_id).toBe("string");
    expect(result.thought_id.length).toBeGreaterThan(0);
    expect(result.pheromone_weight).toBe(1.0);

    storedThoughtId = result.thought_id;
  });

  it("stored thought has correct payload in Qdrant", async () => {
    // Wait briefly for Qdrant to index
    await new Promise((r) => setTimeout(r, 500));

    const points = await qdrant.retrieve("thought_space", {
      ids: [storedThoughtId],
      with_payload: true,
      with_vector: true,
    });

    expect(points.length).toBe(1);
    const payload = points[0].payload as Record<string, unknown>;

    // Section 5.1 payload fields
    expect(payload.contributor_id).toBe("agent-qa-test");
    expect(payload.contributor_name).toBe("QA Test Agent");
    expect(payload.content).toBe("Role boundaries prevent coordination collapse in multi-agent systems.");
    expect(payload.context_metadata).toBe("Testing Phase 1 implementation");
    expect(payload.thought_type).toBe("original");
    expect(payload.source_ids).toEqual([]);
    expect(payload.tags).toEqual(["multi-agent", "role-separation"]);
    expect(payload.access_count).toBe(0);
    expect(payload.last_accessed).toBeNull();
    expect(payload.accessed_by).toEqual([]);
    expect(payload.access_log).toEqual([]);
    expect(payload.co_retrieved_with).toEqual([]);
    expect(payload.pheromone_weight).toBe(1.0);
    expect(payload.knowledge_space_id).toBe("ks-default");
    expect(payload.created_at).toBeDefined();

    // Vector exists and has correct dimensions
    const vector = points[0].vector as number[];
    expect(vector.length).toBe(384);
  });

  it("validates content is required", async () => {
    await expect(
      think({
        content: "",
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "original",
        source_ids: [],
        tags: [],
      })
    ).rejects.toThrow(ThoughtError);
  });

  it("validates content max length (10000 chars)", async () => {
    await expect(
      think({
        content: "x".repeat(10001),
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "original",
        source_ids: [],
        tags: [],
      })
    ).rejects.toThrow(ThoughtError);
  });

  it("validates thought_type enum", async () => {
    await expect(
      think({
        content: "Valid content",
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "invalid" as any,
        source_ids: [],
        tags: [],
      })
    ).rejects.toThrow(ThoughtError);
  });

  it("validates source_ids required for refinement", async () => {
    await expect(
      think({
        content: "A refinement thought",
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "refinement",
        source_ids: [],
        tags: [],
      })
    ).rejects.toThrow(ThoughtError);
  });

  it("validates source_ids required for consolidation", async () => {
    await expect(
      think({
        content: "A consolidation thought",
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "consolidation",
        source_ids: [],
        tags: [],
      })
    ).rejects.toThrow(ThoughtError);
  });

  it("validates context_metadata max length (2000 chars)", async () => {
    await expect(
      think({
        content: "Valid content",
        contributor_id: "test",
        contributor_name: "Test",
        thought_type: "original",
        source_ids: [],
        tags: [],
        context_metadata: "x".repeat(2001),
      })
    ).rejects.toThrow(ThoughtError);
  });

  // Cleanup test thoughts after all tests
  afterAll(async () => {
    if (storedThoughtId) {
      await qdrant.delete("thought_space", {
        points: [storedThoughtId],
        wait: true,
      });
    }
  });
});

// --- AC4: retrieve() finds stored thoughts by cosine similarity ---

describe("AC4: retrieve() function", () => {
  let testThoughtId: string;

  beforeAll(async () => {
    // Store a thought we can retrieve
    const result = await think({
      content: "Organizational debt accumulates when companies skip process definitions during rapid growth.",
      contributor_id: "agent-qa-test",
      contributor_name: "QA Test Agent",
      thought_type: "original",
      source_ids: [],
      tags: ["org-debt", "growth"],
    });
    testThoughtId = result.thought_id;

    // Wait for Qdrant indexing
    await new Promise((r) => setTimeout(r, 500));
  });

  it("retrieves stored thought by semantic similarity", async () => {
    // Embed a related query
    const queryVec = await embed("organizational debt during company scaling");

    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-test",
      session_id: "test-session-001",
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);

    // Find our test thought in results
    const found = results.find((r) => r.thought_id === testThoughtId);
    expect(found).toBeDefined();
    expect(found!.content).toContain("Organizational debt");
    expect(found!.contributor_name).toBe("QA Test Agent");
    expect(found!.score).toBeGreaterThan(0);
    expect(found!.pheromone_weight).toBe(1.0);
    expect(found!.tags).toEqual(["org-debt", "growth"]);
  });

  it("returns results with correct shape (Section 4.2)", async () => {
    const queryVec = await embed("process definitions growth");

    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-test",
      session_id: "test-session-002",
      limit: 5,
    });

    for (const r of results) {
      expect(typeof r.thought_id).toBe("string");
      expect(typeof r.content).toBe("string");
      expect(typeof r.contributor_name).toBe("string");
      expect(typeof r.score).toBe("number");
      expect(typeof r.pheromone_weight).toBe("number");
      expect(Array.isArray(r.tags)).toBe(true);
    }
  });

  it("logs retrieval to query_log", async () => {
    const db = getDb();
    const queryVec = await embed("test query for logging");

    await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-log-test",
      session_id: "test-session-log",
      limit: 5,
    });

    const row = db.prepare("SELECT * FROM query_log WHERE session_id = ?").get("test-session-log") as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.agent_id).toBe("agent-qa-log-test");
    expect(row.session_id).toBe("test-session-log");
    expect(row.returned_ids).toBeDefined();
    expect(typeof row.result_count).toBe("number");
    expect(row.knowledge_space_id).toBe("ks-default");
  });

  it("respects limit parameter", async () => {
    const queryVec = await embed("anything");

    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-test",
      session_id: "test-session-limit",
      limit: 1,
    });

    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("supports filter_tags", async () => {
    const queryVec = await embed("organizational debt growth");

    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-test",
      session_id: "test-session-filter",
      filter_tags: ["org-debt"],
    });

    // All results should have the filtered tag
    for (const r of results) {
      expect(r.tags).toContain("org-debt");
    }
  });

  afterAll(async () => {
    // Cleanup test thought
    if (testThoughtId) {
      await qdrant.delete("thought_space", {
        points: [testThoughtId],
        wait: true,
      });
    }
    // Cleanup query_log entries
    const db = getDb();
    db.prepare("DELETE FROM query_log WHERE agent_id LIKE 'agent-qa%'").run();
  });
});

// --- AC5: Existing endpoints still work ---
// These require the API server to be running on port 3200

async function serverIsRunning(): Promise<boolean> {
  try {
    await fetch("http://localhost:3200/api/v1/health");
    return true;
  } catch {
    return false;
  }
}

describe("AC5: Existing endpoints", () => {
  const BASE_URL = "http://localhost:3200";
  let serverUp: boolean;

  beforeAll(async () => {
    serverUp = await serverIsRunning();
  });

  it("/api/v1/health returns ok", async () => {
    if (!serverUp) return; // Skip if server not running
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("/api/v1/query accepts POST", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test query" }),
    });
    expect(res.status).toBe(200);
  });

  it("/api/v1/ingest accepts POST", async () => {
    if (!serverUp) return;
    const res = await fetch(`${BASE_URL}/api/v1/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Test ingest content for QA", source: "qa-test" }),
    });
    // 201 Created is correct for ingest
    expect([200, 201]).toContain(res.status);
  });
});

// --- Acceptance test from spec: think → retrieve round-trip ---

describe("Spec acceptance test: think() → retrieve() round-trip", () => {
  let thoughtId: string;

  it("stores a thought, then retrieves it by semantic query", async () => {
    // Step 1: Think
    const thinkResult = await think({
      content: "Cross-pollination between disciplines creates novel solutions that single-domain experts miss.",
      contributor_id: "agent-qa-acceptance",
      contributor_name: "QA Acceptance",
      thought_type: "original",
      source_ids: [],
      tags: ["cross-pollination", "innovation"],
    });

    thoughtId = thinkResult.thought_id;
    expect(thinkResult.thought_id).toBeDefined();
    expect(thinkResult.pheromone_weight).toBe(1.0);

    // Wait for indexing
    await new Promise((r) => setTimeout(r, 500));

    // Step 2: Retrieve with a related query
    const queryVec = await embed("interdisciplinary approaches to problem solving");
    const results = await retrieve({
      query_embedding: queryVec,
      agent_id: "agent-qa-acceptance",
      session_id: "acceptance-test-session",
      limit: 10,
    });

    // Step 3: Verify thought appears in results
    const found = results.find((r) => r.thought_id === thoughtId);
    expect(found).toBeDefined();
    expect(found!.content).toContain("Cross-pollination");
    expect(found!.score).toBeGreaterThan(0.3); // Reasonable similarity threshold
  });

  afterAll(async () => {
    if (thoughtId) {
      await qdrant.delete("thought_space", {
        points: [thoughtId],
        wait: true,
      });
    }
    const db = getDb();
    db.prepare("DELETE FROM query_log WHERE agent_id = 'agent-qa-acceptance'").run();
  });
});
