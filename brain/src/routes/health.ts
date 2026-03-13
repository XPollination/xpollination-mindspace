import type { FastifyInstance } from "fastify";
import { isHealthy, getCollectionInfo } from "../services/vectordb.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/health", async (_request, reply) => {
    const qdrantOk = await isHealthy();

    const bpInfo = await getCollectionInfo("best_practices");
    const qInfo = await getCollectionInfo("queries");

    return reply.send({
      status: qdrantOk ? "ok" : "error",
      qdrant: qdrantOk,
      collections: {
        best_practices: bpInfo?.points_count ?? 0,
        queries: qInfo?.points_count ?? 0,
      },
    });
  });

  app.get("/api/v1/", async (_request, reply) => {
    return reply.send({
      name: "bestpractice.xpollination.earth API",
      version: "0.0.1",
      endpoints: {
        "POST /api/v1/query": {
          description: "Search best practices by semantic query",
          body: {
            query: "string (required) — your question or search text",
            domain: "string (optional) — filter by domain: layout, cv-content, knowledge-management, social-media",
            intent: "string (optional) — research, apply, review (default: research)",
            language: "string (optional) — en, de (default: en)",
          },
          response: "{ query, matches: [{ id, score, content, metadata }], total }",
        },
        "POST /api/v1/ingest": {
          description: "Store new content as a best practice",
          body: {
            content: "string (required) — the content to store",
            metadata: "{ domain?: string, source?: string } (optional)",
          },
          response: "{ id, status }",
        },
        "GET /api/v1/health": {
          description: "Server and Qdrant health check",
          response: "{ status, qdrant, collections }",
        },
      },
    });
  });
}
