# PDSA: Marketplace Matching Logic

**Task:** ms-a14-3-marketplace-matching
**Status:** Design
**Version:** v0.0.1

## Plan

Matching endpoint that finds marketplace announcements that could fulfill open requests. Uses keyword/tag overlap scoring.

### Dependencies
- ms-a14-1-marketplace-announcements (announcements table)
- ms-a14-2-marketplace-requests (requests table)

### Investigation

**Design decisions:**
1. GET `/api/marketplace/matches` — finds announcements matching open requests
2. POST `/api/marketplace/requests/:id/match` — manually links request to announcement
3. Matching algorithm: tag overlap scoring (intersection / union of tags)
4. Minimum score threshold (configurable, default 0.3)
5. Returns matches sorted by score descending

## Do

### File Changes

#### 1. `api/routes/marketplace-matching.ts` (CREATE)
```typescript
// GET /matches — find matching announcements for open requests
router.get('/matches', (req, res) => {
  const db = getDb();
  const requests = db.prepare("SELECT * FROM marketplace_requests WHERE status = 'open'").all() as any[];
  const announcements = db.prepare("SELECT * FROM marketplace_announcements WHERE status = 'active'").all() as any[];

  const matches = [];
  for (const request of requests) {
    const reqTags = JSON.parse(request.tags || '[]');
    for (const announcement of announcements) {
      const annTags = JSON.parse(announcement.tags || '[]');
      const intersection = reqTags.filter((t: string) => annTags.includes(t));
      const union = new Set([...reqTags, ...annTags]);
      const score = union.size > 0 ? intersection.length / union.size : 0;
      if (score >= 0.3) {
        matches.push({ request_id: request.id, announcement_id: announcement.id, score, matching_tags: intersection });
      }
    }
  }
  matches.sort((a, b) => b.score - a.score);
  res.status(200).json(matches);
});

// POST /requests/:id/match — link request to announcement
router.post('/requests/:requestId/match', (req, res) => {
  const { requestId } = req.params;
  const { announcement_id } = req.body;
  // Create match record linking request to announcement
});
```

## Study

### Test Cases (8)
1. Matching returns announcements with overlapping tags
2. Score calculated correctly (intersection/union)
3. Results sorted by score descending
4. Below-threshold matches excluded (score < 0.3)
5. Empty tags → no matches
6. POST link creates association
7. Only open requests considered
8. Only active announcements considered

## Act
- 1 new route file, mount in project router
- Depends on marketplace tables from A14-1 and A14-2
