import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { embed } from "../services/embedding.js";
import { upsert } from "../services/vectordb.js";
import type { IngestRequest } from "../types/index.js";

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: IngestRequest }>("/api/v1/ingest", async (request, reply) => {
    const { content, metadata } = request.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return reply.status(400).send({ error: "content is required" });
    }

    const id = uuidv4();
    const vector = await embed(content.trim());

    await upsert("best_practices", id, vector, {
      content: content.trim(),
      domain: metadata?.domain ?? "general",
      source: metadata?.source ?? "api",
      timestamp: new Date().toISOString(),
    });

    return reply.status(201).send({
      id,
      status: "stored",
    });
  });
}
