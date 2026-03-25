import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getDb } from '../db/connection.js';

export const livekitRouter = Router();

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const FLAG_NAME = 'XPO_FEATURE_LIVEKIT_MEETING';

function userHasFlag(userId: string, projectSlug: string): boolean {
  const db = getDb();
  const flag = db.prepare(
    "SELECT * FROM feature_flags WHERE project_slug = ? AND flag_name = ? AND state = 'on'"
  ).get(projectSlug, FLAG_NAME) as any;

  if (!flag) return false;
  if (!flag.allowed_user_ids) return true;
  try {
    const ids = JSON.parse(flag.allowed_user_ids);
    return Array.isArray(ids) && ids.includes(userId);
  } catch { return false; }
}

// GET /token?room=mindspace-admin
livekitRouter.get('/token', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const room = (req.query.room as string) || 'mindspace-admin';

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    res.status(503).json({ error: 'LiveKit not configured' });
    return;
  }

  if (!userHasFlag(user.id, 'xpollination-mindspace')) {
    res.status(403).json({ error: 'Meeting feature not available for this user' });
    return;
  }

  // Each device gets a unique identity so multiple devices can join simultaneously.
  // Display name stays the same — others see "Thomas" twice, LiveKit sees two distinct participants.
  const deviceSuffix = randomUUID().slice(0, 6);
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `${user.id}_${deviceSuffix}`,
    name: user.name || user.email,
    ttl: '10m',
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  res.status(200).json({
    token: await token.toJwt(),
    url: LIVEKIT_URL,
    roomName: room,
    participantName: user.name || user.email,
  });
});

function getRoomService(): RoomServiceClient | null {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;
  const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
  return new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

// POST /kick — remove participant from room
livekitRouter.post('/kick', async (req: Request, res: Response) => {
  const { room, identity } = req.body;
  if (!room || !identity) { res.status(400).json({ error: 'room and identity required' }); return; }
  const svc = getRoomService();
  if (!svc) { res.status(503).json({ error: 'LiveKit not configured' }); return; }
  try {
    await svc.removeParticipant(room, identity);
    res.status(200).json({ ok: true, removed: identity });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to kick participant' });
  }
});

// POST /mute — mute a participant's track
livekitRouter.post('/mute', async (req: Request, res: Response) => {
  const { room, identity, trackSid, muted } = req.body;
  if (!room || !identity || !trackSid) { res.status(400).json({ error: 'room, identity, trackSid required' }); return; }
  const svc = getRoomService();
  if (!svc) { res.status(503).json({ error: 'LiveKit not configured' }); return; }
  try {
    await svc.mutePublishedTrack(room, identity, trackSid, muted !== false);
    res.status(200).json({ ok: true, muted: muted !== false });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to mute' });
  }
});

// POST /brain-query — proxy transcript to Brain API, return structured context cards
livekitRouter.post('/brain-query', async (req: Request, res: Response) => {
  const { query, topic, drill } = req.body;
  if (!query) { res.status(400).json({ error: 'query required' }); return; }

  const brainUrl = process.env.BRAIN_API_URL || 'http://localhost:3200';
  try {
    const brainResp = await fetch(`${brainUrl}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.BRAIN_AGENT_KEY || ''}` },
      body: JSON.stringify({
        prompt: query,
        agent_id: 'agent-meeting',
        agent_name: 'Meeting Agent',
        session_id: `meeting-${Date.now()}`,
        read_only: true,
      }),
    });
    if (!brainResp.ok) {
      res.status(200).json({ insights: [] });
      return;
    }
    const data = await brainResp.json() as any;
    const sources = data.result?.sources || [];
    if (sources.length === 0) {
      res.status(200).json({ insights: [] });
      return;
    }

    // Build human-readable insights from sources
    const insights = sources.slice(0, 5).map((s: any) => ({
      contributor: s.contributor || 'Unknown',
      content: (s.content_preview || '').slice(0, 250),
      score: s.score || 0,
      thought_id: s.thought_id || null,
      category: s.thought_category || null,
      topic: s.topic || null,
    }));

    // Create a concise summary from the top result (strip agent metadata noise)
    const topContent = insights[0].content;
    const summary = cleanSummary(topContent);

    // Extract drill-down topics from: source topics, highways, categories
    const drillTopics = extractDrillTopics(sources, data.result?.highways_nearby || [], topic || query);

    // Use a clean display topic
    const displayTopic = topic || extractDisplayTopic(query);

    res.status(200).json({ topic: displayTopic, summary, insights, drill_topics: drillTopics });
  } catch (e: any) {
    res.status(200).json({ insights: [], error: e.message });
  }
});

/** Extract a display topic from raw speech text (take first meaningful phrase) */
function extractDisplayTopic(text: string): string {
  // Take first 5 meaningful words as topic
  const stopwords = new Set(['aber','auch','dass','dies','eine','haben','sein','sind','wird','über','nach','noch','oder','wenn','alle','kann','mehr','muss','soll','weil','denn','dann','hier','dort','jetzt','schon','nicht','sehr','ganz','doch','also','gibt','irgendetwas','etwas','zum','thema']);
  const words = text.split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w.toLowerCase()));
  return words.slice(0, 5).join(' ') || text.slice(0, 40);
}

/** Strip agent metadata prefixes (e.g. "[QA] TASK active->review:") to get human-readable text */
function cleanSummary(text: string): string {
  return text
    .replace(/^\[[\w]+\]\s*/g, '')                    // [AGENT] prefix
    .replace(/^TASK\s+\S+:\s*/g, '')                  // TASK state->state: prefix
    .replace(/^\*\*[\w\s]+:\*\*\s*/g, '')             // **Label:** prefix
    .replace(/\([^)]*score[^)]*\)/gi, '')             // (score: 0.xx)
    .trim();
}

/** Extract clean drill-down topic labels from brain response */
function extractDrillTopics(sources: any[], highways: any[], currentTopic: string): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  const currentLower = currentTopic.toLowerCase();

  // From source topics (most specific)
  for (const s of sources) {
    if (s.topic && !seen.has(s.topic) && s.topic.toLowerCase() !== currentLower) {
      seen.add(s.topic);
      topics.push(s.topic);
    }
  }

  // From highways — extract a short label (first 40 chars, cut at word boundary)
  for (const hw of highways) {
    const raw = typeof hw === 'string' ? hw : (hw.label || hw.topic || '');
    if (!raw) continue;
    const label = raw.slice(0, 50).replace(/\s\S*$/, '').replace(/[.,:;—–\-]+$/, '').trim();
    if (label.length > 5 && !seen.has(label) && label.toLowerCase() !== currentLower) {
      seen.add(label);
      topics.push(label);
    }
  }

  // From source categories (broadest)
  for (const s of sources) {
    const cat = s.thought_category;
    if (cat && !seen.has(cat) && cat !== 'agent_conclusion') {
      const label = cat.replace(/_/g, ' ');
      if (!seen.has(label)) { seen.add(label); topics.push(label); }
    }
  }

  return topics.slice(0, 4);
}

// GET /participants — list participants in a room (for zombie detection)
livekitRouter.get('/participants', async (req: Request, res: Response) => {
  const room = (req.query.room as string) || 'mindspace-admin';
  const svc = getRoomService();
  if (!svc) { res.status(503).json({ error: 'LiveKit not configured' }); return; }
  try {
    const participants = await svc.listParticipants(room);
    res.status(200).json(participants.map(p => ({
      identity: p.identity, name: p.name, joinedAt: p.joinedAt,
      tracks: p.tracks?.map(t => ({ sid: t.sid, type: t.type, source: t.source, muted: t.muted })) || [],
    })));
  } catch (e: any) {
    res.status(200).json([]);
  }
});
