# PDSA: Community Needs Aggregation Endpoint

**Task:** ms-a15-1-community-needs
**Status:** Design
**Version:** v0.0.1

## Plan

Endpoint that queries the public brain for feature request thoughts, groups them by similarity, and returns aggregated list with frequency counts.

### Dependencies
- ms-a14-1-marketplace-announcements

### Investigation

**Design decisions:**
1. GET `/api/marketplace/community-needs`
2. Queries brain API with prompt about feature requests/community needs
3. Groups returned thoughts by similarity (topic field or keyword clustering)
4. Returns `[{ need: string, count: number, thought_ids: string[] }]`
5. Caching: optional TTL cache (5 min) to avoid hammering brain on repeated calls

## Do

### File Changes

#### 1. `api/routes/community-needs.ts` (CREATE)
```typescript
router.get('/', async (req, res) => {
  const brainResponse = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${BRAIN_API_KEY}` },
    body: JSON.stringify({
      prompt: 'Feature requests, community needs, and improvement suggestions',
      agent_id: 'system',
      agent_name: 'SYSTEM',
      read_only: true
    })
  });

  const data = await brainResponse.json();
  const sources = data.result?.sources || [];

  // Group by topic
  const groups: Record<string, { count: number; thought_ids: string[] }> = {};
  for (const s of sources) {
    const key = s.topic || 'uncategorized';
    if (!groups[key]) groups[key] = { count: 0, thought_ids: [] };
    groups[key].count++;
    groups[key].thought_ids.push(s.thought_id);
  }

  const needs = Object.entries(groups).map(([need, data]) => ({ need, ...data }));
  needs.sort((a, b) => b.count - a.count);
  res.status(200).json(needs);
});
```

## Study

### Test Cases (6)
1. Returns grouped community needs
2. Groups sorted by frequency (highest first)
3. Each group has count and thought_ids
4. Empty brain → empty array
5. Brain API down → 503 error
6. Uncategorized thoughts grouped under 'uncategorized'

## Act
- 1 new route file
- Depends on brain API availability
