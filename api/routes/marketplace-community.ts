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

// POST /digest — agent-assisted digest generation
// Accepts { topic } or { thought_ids }, queries brain for cluster, produces summary,
// stores as domain_summary brain thought, returns { summary, brain_thought_id }
marketplaceCommunityRouter.post('/digest', async (req: Request, res: Response) => {
  const { topic, thought_ids } = req.body;

  if (!topic && (!thought_ids || !Array.isArray(thought_ids) || thought_ids.length === 0)) {
    res.status(400).json({ error: 'Missing required field: topic or thought_ids' });
    return;
  }

  try {
    // Query brain/memory for related thoughts in cluster
    const queryPrompt = topic
      ? `Summarize all knowledge about: ${topic}`
      : `Summarize thoughts: ${thought_ids.join(', ')}`;

    const queryResponse = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt: queryPrompt,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        read_only: true
      })
    });

    const queryData = await queryResponse.json() as any;
    const sources = queryData?.result?.sources || [];

    // Template-based summary generation
    const topicLabel = topic || 'cluster';
    const sourceCount = sources.length;
    const keyInsights = sources.slice(0, 5).map((s: any) => s.content_preview || '').filter(Boolean);

    const summary = `Digest for "${topicLabel}": ${sourceCount} related thoughts found. ` +
      `Key insights: ${keyInsights.length > 0 ? keyInsights.join('; ') : 'No detailed insights available.'}`;

    // Store summary as domain_summary brain thought
    const contributeResponse = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt: summary,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        thought_category: 'domain_summary',
        topic: topicLabel,
        context: `digest from ${sourceCount} sources`
      })
    });

    const contributeData = await contributeResponse.json() as any;
    const brain_thought_id = contributeData?.result?.sources?.[0]?.thought_id || null;

    res.status(200).json({ summary, brain_thought_id });
  } catch (err) {
    res.status(500).json({ error: 'Digest generation failed' });
  }
});
