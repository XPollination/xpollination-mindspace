import { Router, Request, Response } from 'express';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const marketplaceCommunityRouter = Router();

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

marketplaceCommunityRouter.use(requireApiKeyOrJwt);

// GET /community-needs — aggregate feature request thoughts from brain
marketplaceCommunityRouter.get('/community-needs', async (req: Request, res: Response) => {
  try {
    // Query brain API for feature_request thoughts
    const response = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt: 'List all feature request needs from the community',
        agent_id: 'system',
        agent_name: 'SYSTEM',
        read_only: true
      })
    });

    if (!response.ok) {
      res.status(200).json([]);
      return;
    }

    const data = await response.json() as any;
    const thoughts = data?.result?.sources || [];

    // Group by topic/similarity
    const groupMap = new Map<string, { need: string; count: number; thought_ids: string[] }>();

    for (const thought of thoughts) {
      const topic = thought.topic || thought.category || 'general';
      const existing = groupMap.get(topic);
      if (existing) {
        existing.count++;
        existing.thought_ids.push(thought.id);
      } else {
        groupMap.set(topic, {
          need: topic,
          count: 1,
          thought_ids: [thought.id]
        });
      }
    }

    // Sort by count descending
    const needs = [...groupMap.values()].sort((a, b) => b.count - a.count);

    res.status(200).json(needs);
  } catch {
    res.status(200).json([]);
  }
});
