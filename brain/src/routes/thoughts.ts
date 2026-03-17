import { FastifyInstance } from "fastify";
import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION = "thought_space";
const client = new QdrantClient({ url: process.env.QDRANT_URL || "http://localhost:6333" });

export async function thoughtsRoutes(app: FastifyInstance) {
  // GET /api/v1/thoughts/by-cid/:cid — lookup thought by content-addressable ID
  app.get("/api/v1/thoughts/by-cid/:cid", async (request, reply) => {
    const { cid } = request.params as { cid: string };

    if (!cid) {
      return reply.status(400).json({ error: "cid parameter is required" });
    }

    try {
      const scrollResult = await client.scroll(COLLECTION, {
        filter: {
          must: [{ key: "cid", match: { value: cid } }],
        },
        limit: 1,
        with_payload: true,
        with_vector: false,
      });

      if (scrollResult.points.length === 0) {
        return reply.status(404).json({ error: `Thought not found for CID: ${cid}` });
      }

      const point = scrollResult.points[0];
      const payload = point.payload as Record<string, unknown>;

      return reply.status(200).json({
        thought_id: String(point.id),
        cid,
        content: payload.content,
        contributor_name: payload.contributor_name,
        thought_type: payload.thought_type,
        thought_category: payload.thought_category,
        topic: payload.topic,
        tags: payload.tags,
        created_at: payload.created_at,
      });
    } catch (err) {
      return reply.status(500).json({ error: `CID lookup failed: ${err}` });
    }
  });
}
