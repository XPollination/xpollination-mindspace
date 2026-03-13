/**
 * Highway Redesign Tests: Context-Weighted Relevance
 *
 * Tests for gardener-highway-redesign task.
 * Acceptance criteria:
 * 1. Query about cover letter returns highways about positioning, not agent coordination
 * 2. Query about brain returns highways about knowledge management, not role separation
 * 3. Highways contextually relevant to query topic
 * 4. Without query_embedding: same global frequency results as before (backward compat)
 *
 * Design: Option B — hybrid vector+frequency highways.
 * - HighwayParams gains optional query_embedding: number[]
 * - When provided: client.search() with vector + access_count filter
 * - When absent: existing scroll behavior unchanged
 */
import { describe, it, expect, beforeAll } from "vitest";
import { QdrantClient } from "@qdrant/js-client-rest";
import { think, highways, HighwayParams } from "./thoughtspace.js";
import { embed } from "./embedding.js";

const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// --- Test fixtures ---

// We create thoughts across two distinct domains:
// Domain A: career/cover-letter related
// Domain B: agent coordination/role separation related
// Both get high access counts to qualify as highway candidates.

let careerThoughtIds: string[] = [];
let agentThoughtIds: string[] = [];

beforeAll(async () => {
  // Domain A: career-related thoughts (simulating high-traffic)
  const careerContents = [
    "Cover letter positioning strategies for senior engineering roles require demonstrating impact through metrics and leadership examples.",
    "Resume optimization and personal branding in the job market help candidates stand out to recruiters and hiring managers.",
    "Interview preparation for technical positions should focus on system design, coding challenges, and behavioral questions.",
  ];

  // Domain B: agent coordination thoughts (simulating high-traffic)
  const agentContents = [
    "Role boundaries prevent coordination collapse in multi-agent architectures through strict separation of concerns.",
    "Agent coordination patterns use message passing and shared state to synchronize work across distributed systems.",
    "Multi-agent task routing ensures each agent receives work matching its capabilities and current availability.",
  ];

  // Create career thoughts with high access counts
  for (const content of careerContents) {
    const result = await think({
      content,
      contributor_id: "agent-test-highway",
      contributor_name: "HighwayTest",
      thought_type: "original",
      source_ids: [],
      tags: ["highway-test", "career"],
    });
    careerThoughtIds.push(result.thought_id);
  }

  // Create agent coordination thoughts with high access counts
  for (const content of agentContents) {
    const result = await think({
      content,
      contributor_id: "agent-test-highway",
      contributor_name: "HighwayTest",
      thought_type: "original",
      source_ids: [],
      tags: ["highway-test", "agents"],
    });
    agentThoughtIds.push(result.thought_id);
  }

  // Simulate high traffic: set access_count and accessed_by on all test thoughts
  const allIds = [...careerThoughtIds, ...agentThoughtIds];
  for (const id of allIds) {
    await qdrant.setPayload("thought_space", {
      points: [id],
      payload: {
        access_count: 50,
        accessed_by: ["agent-a", "agent-b", "agent-c", "agent-d"],
      },
      wait: true,
    });
  }
}, 30_000);

// --- AC1: HighwayParams accepts query_embedding ---

describe("HighwayParams type", () => {
  it("highways() accepts query_embedding parameter", async () => {
    const queryVec = await embed("cover letter positioning");
    // This call must not throw — query_embedding is a valid param
    const results = await highways({ query_embedding: queryVec, limit: 5 });
    expect(Array.isArray(results)).toBe(true);
  });
});

// --- AC2: Context-weighted relevance ---

describe("Context-weighted highways", () => {
  it("career query returns career-related highways, not agent coordination", async () => {
    const queryVec = await embed("cover letter positioning strategies for job applications");
    const results = await highways({
      query_embedding: queryVec,
      min_access: 3,
      min_users: 2,
      limit: 5,
    });

    // Should have results
    expect(results.length).toBeGreaterThan(0);

    // Check that results contain career-related content, not agent coordination
    const previews = results.map((r) => r.content_preview.toLowerCase());
    const hasCareerContent = previews.some(
      (p) => p.includes("cover letter") || p.includes("resume") || p.includes("interview")
    );
    const hasAgentContent = previews.some(
      (p) => p.includes("role boundaries") || p.includes("agent coordination")
    );

    expect(hasCareerContent).toBe(true);
    // Agent coordination content should NOT dominate career query highways
    // At minimum, career content should appear before agent content
    if (hasAgentContent) {
      // If both present, career should be ranked higher (appear first)
      const firstCareerIdx = previews.findIndex(
        (p) => p.includes("cover letter") || p.includes("resume") || p.includes("interview")
      );
      const firstAgentIdx = previews.findIndex(
        (p) => p.includes("role boundaries") || p.includes("agent coordination")
      );
      expect(firstCareerIdx).toBeLessThan(firstAgentIdx);
    }
  });

  it("brain/knowledge query returns knowledge-related highways, not career content", async () => {
    const queryVec = await embed("brain knowledge management and agent coordination patterns");
    const results = await highways({
      query_embedding: queryVec,
      min_access: 3,
      min_users: 2,
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);

    const previews = results.map((r) => r.content_preview.toLowerCase());
    const hasAgentContent = previews.some(
      (p) =>
        p.includes("role boundaries") ||
        p.includes("agent coordination") ||
        p.includes("multi-agent")
    );
    const hasCareerContent = previews.some(
      (p) => p.includes("cover letter") || p.includes("resume")
    );

    expect(hasAgentContent).toBe(true);
    if (hasCareerContent) {
      const firstAgentIdx = previews.findIndex(
        (p) =>
          p.includes("role boundaries") ||
          p.includes("agent coordination") ||
          p.includes("multi-agent")
      );
      const firstCareerIdx = previews.findIndex(
        (p) => p.includes("cover letter") || p.includes("resume")
      );
      expect(firstAgentIdx).toBeLessThan(firstCareerIdx);
    }
  });
});

// --- AC3: Backward compatibility ---

describe("Backward compatibility", () => {
  it("highways() without query_embedding returns global frequency results", async () => {
    // No query_embedding — existing scroll behavior
    const results = await highways({ min_access: 3, min_users: 2, limit: 5 });
    expect(Array.isArray(results)).toBe(true);
    // Results should be sorted by traffic_score (global frequency)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].traffic_score).toBeGreaterThanOrEqual(results[i].traffic_score);
    }
  });

  it("HighwayResult shape is unchanged", async () => {
    const results = await highways({ limit: 1 });
    if (results.length > 0) {
      const r = results[0];
      expect(r).toHaveProperty("thought_id");
      expect(r).toHaveProperty("content_preview");
      expect(r).toHaveProperty("access_count");
      expect(r).toHaveProperty("unique_users");
      expect(r).toHaveProperty("traffic_score");
      expect(r).toHaveProperty("pheromone_weight");
      expect(r).toHaveProperty("tags");
    }
  });
});

// --- AC4: Different queries produce different highways ---

describe("Query differentiation", () => {
  it("two different topic queries return different highway sets", async () => {
    const careerVec = await embed("cover letter and resume writing tips");
    const agentVec = await embed("multi-agent coordination and role separation patterns");

    const careerHighways = await highways({
      query_embedding: careerVec,
      min_access: 3,
      min_users: 2,
      limit: 5,
    });
    const agentHighways = await highways({
      query_embedding: agentVec,
      min_access: 3,
      min_users: 2,
      limit: 5,
    });

    // The two result sets should not be identical — different queries yield different highways
    if (careerHighways.length > 0 && agentHighways.length > 0) {
      const careerIds = careerHighways.map((r) => r.thought_id);
      const agentIds = agentHighways.map((r) => r.thought_id);
      // At least the top result should differ
      expect(careerIds[0]).not.toBe(agentIds[0]);
    }
  });
});
