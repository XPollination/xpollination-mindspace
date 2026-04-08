/**
 * OAuth Device Flow (RFC 8628) — CLI Agent Authentication
 *
 * Flow:
 *   1. CLI calls POST /api/auth/device/code → gets device_code + user_code
 *   2. CLI prints: "Go to /device and enter code: ABCD-1234"
 *   3. User opens /device in browser (already logged in), enters user_code, approves
 *   4. CLI polls POST /api/auth/device/token → gets JWT when approved
 *   5. CLI passes JWT to xpo-agent bodies → agents authenticate with JWT
 *
 * Security: api/routes/SECURITY.md
 * Mission: docs/missions/mission-agent-oauth-sessions.md
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const CODE_EXPIRY_MINUTES = 15;
const POLL_INTERVAL_SECONDS = 5;
const TOKEN_EXPIRY = '24h';

/**
 * Generate a human-readable user code: XXXX-XXXX (letters + digits, no ambiguous chars)
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}

/**
 * POST /api/auth/device/code — Start device flow
 * No auth required (the CLI doesn't have credentials yet — that's the point)
 */
router.post('/code', (req: Request, res: Response) => {
  const db = getDb();
  const { client_name } = req.body || {};

  const id = crypto.randomUUID();
  const deviceCode = crypto.randomBytes(32).toString('hex');
  const deviceCodeHash = crypto.createHash('sha256').update(deviceCode).digest('hex');
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const ip = req.ip || req.socket.remoteAddress || '';

  // Determine verification URL from request or env
  const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  const verificationUri = `${frontendUrl}/device`;

  db.prepare(
    'INSERT INTO device_codes (id, device_code_hash, user_code, status, client_name, ip_address, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, deviceCodeHash, userCode, 'pending', client_name || 'claude-session', ip, expiresAt);

  res.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: `${verificationUri}?code=${userCode}`,
    expires_in: CODE_EXPIRY_MINUTES * 60,
    interval: POLL_INTERVAL_SECONDS,
  });
});

/**
 * POST /api/auth/device/token — Poll for approval
 * No auth required (CLI uses device_code to prove identity)
 */
router.post('/token', (req: Request, res: Response) => {
  const db = getDb();
  const { device_code } = req.body || {};

  if (!device_code) {
    res.status(400).json({ error: 'invalid_request', error_description: 'device_code is required' });
    return;
  }

  const deviceCodeHash = crypto.createHash('sha256').update(device_code).digest('hex');
  const row = db.prepare('SELECT * FROM device_codes WHERE device_code_hash = ?').get(deviceCodeHash) as any;

  if (!row) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Unknown device code' });
    return;
  }

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("UPDATE device_codes SET status = 'expired' WHERE id = ?").run(row.id);
    res.status(400).json({ error: 'expired_token', error_description: 'Device code expired. Start a new flow.' });
    return;
  }

  // Check status
  if (row.status === 'used') {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Device code already used' });
    return;
  }

  if (row.status === 'pending') {
    res.status(400).json({ error: 'authorization_pending', error_description: 'Waiting for user approval' });
    return;
  }

  if (row.status === 'approved' && row.user_id) {
    // Issue JWT
    const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(row.user_id) as any;
    if (!user) {
      res.status(500).json({ error: 'server_error', error_description: 'User not found' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, device_flow: true, client_name: row.client_name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Mark as used (one-time)
    db.prepare("UPDATE device_codes SET status = 'used' WHERE id = ?").run(row.id);

    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 86400, // 24h
    });
    return;
  }

  res.status(400).json({ error: 'invalid_grant', error_description: 'Unexpected status' });
});

/**
 * POST /api/auth/device/approve — User approves device code
 * Requires JWT auth (user must be logged in via browser)
 */
router.post('/approve', (req: Request, res: Response) => {
  const db = getDb();
  const { user_code } = req.body || {};

  if (!user_code) {
    res.status(400).json({ error: 'user_code is required' });
    return;
  }

  // Authenticate user from JWT (viz proxy adds Authorization header from ms_session cookie)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Log in to Mindspace first.' });
    return;
  }

  let userId: string;
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    userId = decoded.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  // Find and approve the device code
  const normalized = user_code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : user_code.toUpperCase();

  const row = db.prepare("SELECT * FROM device_codes WHERE user_code = ? AND status = 'pending'").get(formatted) as any;

  if (!row) {
    res.status(404).json({ error: 'Invalid or expired code. Check the code and try again.' });
    return;
  }

  if (new Date(row.expires_at) < new Date()) {
    db.prepare("UPDATE device_codes SET status = 'expired' WHERE id = ?").run(row.id);
    res.status(400).json({ error: 'Code expired. Start a new session from the terminal.' });
    return;
  }

  // Approve
  db.prepare("UPDATE device_codes SET status = 'approved', user_id = ?, approved_at = datetime('now') WHERE id = ?")
    .run(userId, row.id);

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;

  res.json({
    success: true,
    message: `Approved. ${row.client_name || 'Agent session'} is now connected as ${user?.name || 'you'}.`,
  });
});

export { router as deviceAuthRouter };
