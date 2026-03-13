import { FastifyInstance } from "fastify";
import { getAgentIdentity, getAgentState } from "../services/database.js";
import { getRecentByContributor } from "../services/thoughtspace.js";

export async function recoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { agentId: string } }>("/api/v1/recovery/:agentId", async (request, reply) => {
    const { agentId } = request.params;

    const identity = getAgentIdentity(agentId);
    if (!identity) {
      return reply.code(404).send({ error: `Agent '${agentId}' not found in identity store` });
    }

    const stateRow = getAgentState(agentId);

    let working_state = null;
    if (stateRow) {
      const updatedAt = new Date(stateRow.updated_at + "Z");
      const age_minutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
      const stale = age_minutes > stateRow.ttl_hours * 60;

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(stateRow.state_json);
      } catch { /* use empty */ }

      working_state = {
        ...parsed,
        updated_at: stateRow.updated_at,
        age_minutes,
        stale,
        session_id: stateRow.session_id,
      };
    }

    let key_context: Array<{ thought_id: string; content: string; category: string; topic: string | null; score: number }> = [];
    let degraded = false;

    try {
      const recent = await getRecentByContributor(agentId, 5);
      key_context = recent.map((t, i) => ({
        thought_id: t.id,
        content: t.content,
        category: t.category,
        topic: t.topic,
        score: 1.0 - i * 0.1,
      }));
    } catch {
      degraded = true;
    }

    const recent_transitions = key_context
      .filter((t) => t.category === "transition_marker")
      .map((t) => t.content.slice(0, 200));

    const recovered_at = new Date().toISOString();

    return reply.send({
      identity: {
        agent_id: identity.agent_id,
        role: identity.role,
        display_name: identity.display_name,
        responsibilities: identity.responsibilities,
        recovery_protocol: identity.recovery_protocol,
      },
      working_state,
      key_context,
      recent_transitions,
      degraded,
      recovered_at,
    });
  });
}
