import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
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

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: user.id,
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
