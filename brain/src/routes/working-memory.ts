import { FastifyInstance } from "fastify";
import { upsertAgentState, getAgentState } from "../services/database.js";

export async function workingMemoryRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { agentId: string }; Body: { session_id?: string; state: Record<string, unknown>; ttl_hours?: number } }>(
    "/api/v1/working-memory/:agentId",
    { config: { bodyLimit: 65536 } },
    async (request, reply) => {
      const { agentId } = request.params;
      const { session_id, state, ttl_hours } = request.body;

      if (!state || typeof state !== "object") {
        return reply.code(400).send({ error: "state field required (JSON object)" });
      }

      const existing = getAgentState(agentId);
      let previous_age_minutes: number | null = null;
      if (existing) {
        const updatedAt = new Date(existing.updated_at + "Z");
        previous_age_minutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
      }

      const stateJson = JSON.stringify(state);
      if (Buffer.byteLength(stateJson) > 65536) {
        return reply.code(413).send({ error: "State exceeds 64KB limit" });
      }

      // INSERT OR REPLACE into agent_state table
      upsertAgentState(agentId, stateJson, session_id || null, ttl_hours ?? 72);

      return reply.send({
        success: true,
        agent_id: agentId,
        updated_at: new Date().toISOString(),
        previous_age_minutes,
      });
    }
  );
}
