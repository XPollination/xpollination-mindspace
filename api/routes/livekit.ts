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

// POST /brain-query — proxy transcript to Brain API for context
livekitRouter.post('/brain-query', async (req: Request, res: Response) => {
  const { query } = req.body;
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
      }),
    });
    if (!brainResp.ok) {
      res.status(200).json({ context: null });
      return;
    }
    const data = await brainResp.json() as any;
    // Extract top relevant sources
    const sources = data.result?.sources || [];
    if (sources.length === 0) {
      res.status(200).json({ context: null });
      return;
    }
    const top = sources.slice(0, 3);
    const context = top.map((s: any) => `[${s.contributor || '?'}] ${s.content_preview || ''}`).join(' | ');
    res.status(200).json({ context, sources: top });
  } catch (e: any) {
    res.status(200).json({ context: null, error: e.message });
  }
});

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
