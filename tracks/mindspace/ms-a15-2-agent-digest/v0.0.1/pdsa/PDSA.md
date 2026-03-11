# PDSA: Agent-Assisted Digest Generation

**Date:** 2026-03-11
**Task:** ms-a15-2-agent-digest
**Capability:** marketplace-community
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a15-1-community-needs (community needs endpoint + brain query)

## Plan

### Problem

Community needs are raw feature request thoughts in the brain. The GET /community-needs endpoint groups them by topic, but the output is unstructured clusters of thought snippets. A human or agent reading this must manually synthesize what the community actually wants. Agent-assisted digestion transforms raw clusters into structured, actionable summaries.

### Evidence

1. **REQ-COMMUNITY-001** — "Agent receives cluster, produces structured summary. Summary stored as brain thought."
2. **GET /community-needs** — returns `{ topic, count, samples[] }` — raw data, not synthesized.
3. **Brain API** — can store digest thoughts with `thought_category: 'domain_summary'`.

### Design

#### REQ-DIGEST-001: Digest Endpoint

`POST /api/marketplace/digest`

Request body:
```json
{ "topic": "real-time-collaboration", "max_thoughts": 20 }
```

Process:
1. Query brain for feature_request thoughts matching topic (up to max_thoughts)
2. Use LLM/agent to produce structured summary: { title, summary, key_needs[], priority_signal, thought_count }
3. Store summary as brain thought with `thought_category: 'domain_summary'`, `topic: <topic>`
4. Return the digest

#### REQ-DIGEST-002: Digest Storage

The digest is stored in the brain as a domain_summary thought:
- `thought_type: 'consolidation'`
- `source_ids: [thought IDs used in digest]`
- `thought_category: 'domain_summary'`
- `topic: <topic>`

This creates traceability from digest back to raw community input.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/marketplace-community.ts` | UPDATE | Add POST /digest endpoint |
| 2 | `api/services/marketplace-brain.ts` | UPDATE | Add `generateDigest(topic, thoughts)` function |

### NOT Changed

- GET /community-needs — unchanged
- Brain API — no changes, uses existing contribute endpoint
- Marketplace announcements/requests/matching — unchanged

### Risks

1. **LLM dependency** — Digest quality depends on summarization capability. v0.0.1 uses simple template-based aggregation (no external LLM call).
2. **Stale digests** — Community needs evolve. Digests should be regenerated periodically. Future: TTL on digest thoughts.

## Do

### File Changes

#### 1. `api/routes/marketplace-community.ts` (UPDATE)
```typescript
app.post('/digest', async (request, reply) => {
  const { topic, max_thoughts } = request.body as { topic: string; max_thoughts?: number };
  if (!topic) return reply.status(400).json({ error: 'topic required' });

  const limit = max_thoughts || 20;
  // Query brain for feature requests on this topic
  const brainResp = await fetch('http://localhost:3200/api/v1/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `community feature requests for ${topic}`, read_only: true, agent_id: 'system' })
  });
  const brainData = await brainResp.json();
  const sources = (brainData.result?.sources || []).slice(0, limit);

  // Template-based digest
  const digest = {
    topic,
    title: `Community Digest: ${topic}`,
    summary: `${sources.length} community thoughts analyzed for "${topic}".`,
    key_needs: sources.map(s => s.content_preview).slice(0, 5),
    priority_signal: sources.length >= 10 ? 'high' : sources.length >= 5 ? 'medium' : 'low',
    thought_count: sources.length,
    source_ids: sources.map(s => s.thought_id)
  };

  // Store as brain domain_summary
  await fetch('http://localhost:3200/api/v1/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `COMMUNITY DIGEST (${topic}): ${digest.summary} Key needs: ${digest.key_needs.join('; ')}`,
      agent_id: 'system', agent_name: 'DIGEST',
      thought_category: 'domain_summary', topic
    })
  });

  return reply.status(200).json(digest);
});
```

## Study

### Test Cases (5)

1. POST /digest with topic returns 200 with structured digest
2. Digest includes key_needs array from brain sources
3. Digest stored as brain thought with domain_summary category
4. POST /digest without topic returns 400
5. Priority signal: high (≥10 thoughts), medium (≥5), low (<5)

## Act

- Template-based digest working → future: LLM-powered summarization
- Traceability via source_ids → know which raw thoughts fed each digest
- Future: scheduled digest regeneration (weekly cron)
