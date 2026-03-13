import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { embed } from "../services/embedding.js";
import { search, upsert } from "../services/vectordb.js";
import type { QueryRequest, SearchResult } from "../types/index.js";

export async function queryRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: QueryRequest }>("/api/v1/query", async (request, reply) => {
    const { query, domain, intent, language } = request.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return reply.status(400).send({ error: "query is required" });
    }

    const vector = await embed(query.trim());

    // Build filter if domain specified
    let filter: Record<string, unknown> | undefined;
    if (domain) {
      filter = {
        must: [{ key: "domain", match: { value: domain } }],
      };
    }

    const results = await search("best_practices", vector, 5, filter);

    // Store query in queries collection for future analysis
    await upsert("queries", uuidv4(), vector, {
      query: query.trim(),
      domain: domain ?? null,
      intent: intent ?? "research",
      language: language ?? "en",
      timestamp: new Date().toISOString(),
      results_count: results.length,
    });

    const matches: SearchResult[] = results.map((r) => ({
      id: r.id,
      score: r.score,
      content: (r.payload.content as string) ?? "",
      metadata: {
        file_path: r.payload.file_path,
        domain: r.payload.domain,
        chunk_index: r.payload.chunk_index,
      },
    }));

    return reply.send({
      query: query.trim(),
      matches,
      total: matches.length,
    });
  });
}
