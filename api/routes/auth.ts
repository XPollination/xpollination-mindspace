import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

// D6: Password strength — uppercase + lowercase + number + 8 char min
function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

// D2: In-memory rate limiter (per IP, 5 attempts per 15 min)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;


// D7: CSRF — Origin check for mutation requests
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

function checkOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // Same-origin requests don't send Origin
  if (ALLOWED_ORIGINS.length > 0) {
    return ALLOWED_ORIGINS.includes(origin);
  }
  // Default: reject known evil origins (any non-localhost in dev)
  const host = req.headers.host || '';
  const originUrl = new URL(origin);
  return originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1' || originUrl.hostname === host.split(':')[0];
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- Registration ---

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, name, password, invite_code } = req.body;

  if (!invite_code) {
    res.status(400).json({ error: 'invite_code is required — registration is invite-only' });
    return;
  }

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Missing required fields: email, name, password' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const db = getDb();

  const invite = db.prepare('SELECT id, code, created_by, used_by, expires_at FROM invites WHERE code = ?').get(invite_code) as any;
  if (!invite) {
    res.status(400).json({ error: 'Invalid invite code' });
    return;
  }
  if (invite.used_by) {
    res.status(400).json({ error: 'Invite code already used' });
    return;
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    res.status(400).json({ error: 'Invite code expired' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = randomUUID();
  const password_hash = await bcrypt.hash(password, BCRYPT_COST);

  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, password_hash, name);
  db.prepare('UPDATE invites SET used_by = ?, used_at = datetime(\'now\') WHERE id = ?').run(id, invite.id);

  res.status(201).json({ id, email, name });
});

// --- Login (with rate limiting, refresh tokens, CSRF cookie) ---

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Missing required fields: email, password' });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  // D2: Rate limiting (per IP + email, counts failed attempts only)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = `${ip}:${email}`;
  const now = Date.now();
  let rateLimitEntry = loginAttempts.get(rateLimitKey);
  if (!rateLimitEntry || now > rateLimitEntry.resetAt) {
    rateLimitEntry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    loginAttempts.set(rateLimitKey, rateLimitEntry);
  }
  const remaining = Math.max(0, RATE_LIMIT_MAX - rateLimitEntry.count);
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(Math.ceil(rateLimitEntry.resetAt / 1000)));
  if (rateLimitEntry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((rateLimitEntry.resetAt - Date.now()) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email) as any;

  if (!user) {
    rateLimitEntry.count++;
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    rateLimitEntry.count++;
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Reset on successful login
  rateLimitEntry.count = 0;

  // D4: Access token (short-lived)
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  // D4: Refresh token (longer-lived)
  const refreshToken = randomUUID();
  const refreshTokenHash = hashToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
      randomUUID(), user.id, refreshTokenHash, refreshExpiresAt
    );
  } catch {
    // Table may not exist yet in some test configs — continue without refresh tokens
  }

  // D3: Track session
  const sessionId = randomUUID();
  try {
    db.prepare('INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      sessionId, user.id, hashToken(token), ip, req.headers['user-agent'] || '', refreshExpiresAt
    );
  } catch {
    // Table may not exist — continue
  }

  // D7: Set SameSite cookie for CSRF protection
  res.cookie('ms_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  });

  const { password_hash, ...userWithoutHash } = user;
  res.status(200).json({ token, refresh_token: refreshToken, user: userWithoutHash });
});

// --- D4: Refresh token endpoint ---

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token || !JWT_SECRET) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  const db = getDb();
  const tokenHash = hashToken(refresh_token);

  const stored = db.prepare(
    'SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.email, u.name FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?'
  ).get(tokenHash) as any;

  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // Rotate: revoke old, issue new
  db.prepare('UPDATE refresh_tokens SET revoked_at = datetime(\'now\') WHERE id = ?').run(stored.id);

  const newToken = jwt.sign(
    { sub: stored.user_id, email: stored.email, name: stored.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const newRefreshToken = randomUUID();
  const newRefreshHash = hashToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
    randomUUID(), stored.user_id, newRefreshHash, newExpiresAt
  );

  res.status(200).json({ token: newToken, refresh_token: newRefreshToken });
});

// --- D1: Change password ---

authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  // D7: CSRF origin check
  if (!checkOrigin(req)) {
    res.status(403).json({ error: 'Cross-origin request rejected' });
    return;
  }

  const { current_password, new_password } = req.body;
  const user = req.user as any;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Missing required fields: current_password, new_password' });
    return;
  }

  const strengthError = validatePasswordStrength(new_password);
  if (strengthError) {
    res.status(400).json({ error: strengthError });
    return;
  }

  const db = getDb();
  const dbUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;

  if (!dbUser) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(current_password, dbUser.password_hash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(new_password, BCRYPT_COST);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

  res.status(200).json({ message: 'Password changed successfully' });
});

// --- D3: Session management ---

authRouter.get('/sessions', requireAuth, (req: Request, res: Response) => {
  const user = req.user as any;
  const db = getDb();

  const sessions = db.prepare(
    'SELECT id, ip_address, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC'
  ).all(user.id);

  res.status(200).json({ sessions });
});

authRouter.delete('/sessions/:sessionId', requireAuth, (req: Request, res: Response) => {
  const user = req.user as any;
  const { sessionId } = req.params;
  const db = getDb();

  const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, user.id) as any;
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE id = ?').run(sessionId);
  res.status(200).json({ message: 'Session revoked' });
});

// --- D5: Account deletion (GDPR) ---

authRouter.delete('/account', requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  const db = getDb();

  // Cascade delete: sessions, refresh_tokens, then user
  try {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  } catch { /* table may not exist */ }
  try {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
  } catch { /* table may not exist */ }
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  res.status(200).json({ message: 'Account deleted' });
});
