import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const marketplaceMatchingRouter = Router();

marketplaceMatchingRouter.use(requireApiKeyOrJwt);

/**
 * Compute Jaccard score between two tag sets (intersection / union).
 */
function jaccardScore(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA.map(t => t.toLowerCase()));
  const setB = new Set(tagsB.map(t => t.toLowerCase()));
  const intersection = [...setA].filter(t => setB.has(t));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

// GET /matches — find announcements matching open requests
marketplaceMatchingRouter.get('/matches', (req: Request, res: Response) => {
  const { threshold } = req.query;
  const minimumThreshold = parseFloat(threshold as string) || 0.3;
  const db = getDb();

  // Get open requests and active announcements
  const requests = db.prepare("SELECT * FROM marketplace_requests WHERE status = 'open'").all() as any[];
  const announcements = db.prepare("SELECT * FROM marketplace_announcements WHERE status = 'active'").all() as any[];

  const matches: any[] = [];

  for (const request of requests) {
    const reqTags = request.tags ? JSON.parse(request.tags) : [request.category];
    for (const announcement of announcements) {
      const annTags = announcement.tags ? JSON.parse(announcement.tags) : [announcement.category];
      const score = jaccardScore(reqTags, annTags);
      if (score >= minimumThreshold) {
        matches.push({
          request_id: request.id,
          announcement_id: announcement.id,
          score,
          request_title: request.title,
          announcement_title: announcement.title
        });
      }
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  res.status(200).json(matches);
});

// POST /requests/:id/match — link request to announcement
marketplaceMatchingRouter.post('/requests/:id/match', (req: Request, res: Response) => {
  const { id } = req.params;
  const { announcement_id } = req.body;
  const db = getDb();

  const request = db.prepare('SELECT * FROM marketplace_requests WHERE id = ?').get(id);
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const announcement = db.prepare('SELECT * FROM marketplace_announcements WHERE id = ?').get(announcement_id);
  if (!announcement) {
    res.status(404).json({ error: 'Announcement not found' });
    return;
  }

  const matchId = randomUUID();
  db.prepare(
    `INSERT INTO marketplace_matches (id, request_id, announcement_id) VALUES (?, ?, ?)`
  ).run(matchId, id, announcement_id);

  // Update request status to matched
  db.prepare("UPDATE marketplace_requests SET status = 'matched', updated_at = datetime('now') WHERE id = ?").run(id);

  res.status(201).json({ id: matchId, request_id: id, announcement_id });
});
