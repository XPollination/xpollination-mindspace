/**
 * xp0.ai OAuth Provider — self-hosted identity provider
 * Endpoints: /oauth/authorize, /oauth/token, /oauth/userinfo, /.well-known/openid-configuration
 */

import { Router, Request, Response } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

export const oauthProviderRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const ISSUER = process.env.OAUTH_ISSUER || 'https://xpollination.earth';
const AUTH_CODE_TTL = 10 * 60; // 10 minutes
const ACCESS_TOKEN_TTL = 3600; // 1 hour
const REFRESH_TOKEN_TTL = 30 * 24 * 3600; // 30 days

// GET /.well-known/openid-configuration
oauthProviderRouter.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    userinfo_endpoint: `${ISSUER}/oauth/userinfo`,
    grant_types_supported: ['authorization_code', 'refresh_token'],
    response_types_supported: ['code'],
    scopes_supported: ['openid', 'profile', 'email'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
  });
});

// GET /oauth/authorize — authorization endpoint
oauthProviderRouter.get('/oauth/authorize', (req: Request, res: Response) => {
  const { client_id, redirect_uri, scope, state, response_type } = req.query;

  if (response_type !== 'code') {
    res.status(400).json({ error: 'unsupported_response_type', description: 'Only response_type=code is supported' });
    return;
  }

  if (!client_id || !redirect_uri) {
    res.status(400).json({ error: 'invalid_request', description: 'client_id and redirect_uri required' });
    return;
  }

  const db = getDb();
  const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(client_id) as any;
  if (!client) {
    res.status(400).json({ error: 'invalid_client', description: 'Client not found' });
    return;
  }

  const allowedUris = JSON.parse(client.redirect_uris || '[]');
  if (!allowedUris.includes(redirect_uri)) {
    res.status(400).json({ error: 'invalid_redirect_uri', description: 'Redirect URI not registered' });
    return;
  }

  // For now, return a simple consent page (in production, render a proper login/consent form)
  const user = (req as any).user;
  if (!user) {
    // Redirect to login with return URL
    res.redirect(`/login?return=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  // User is authenticated — generate authorization code
  const code = randomBytes(32).toString('hex');
  const codeHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL * 1000).toISOString();

  db.prepare(
    'INSERT INTO oauth_authorization_codes (code_hash, client_id, user_id, redirect_uri, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(codeHash, client_id, user.id || user.user_id, redirect_uri, scope || 'openid', expiresAt);

  const redirectUrl = new URL(redirect_uri as string);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state as string);
  res.redirect(redirectUrl.toString());
});

// POST /oauth/token — token exchange
oauthProviderRouter.post('/oauth/token', (req: Request, res: Response) => {
  const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = req.body;
  const db = getDb();

  if (grant_type === 'authorization_code') {
    if (!code || !client_id) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    // Validate client
    const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(client_id) as any;
    if (!client) { res.status(401).json({ error: 'invalid_client' }); return; }

    if (client.client_secret_hash && client_secret) {
      const secretHash = createHash('sha256').update(client_secret).digest('hex');
      if (secretHash !== client.client_secret_hash) { res.status(401).json({ error: 'invalid_client' }); return; }
    }

    // Validate code
    const codeHash = createHash('sha256').update(code).digest('hex');
    const authCode = db.prepare(
      "SELECT * FROM oauth_authorization_codes WHERE code_hash = ? AND client_id = ? AND expires_at > datetime('now')"
    ).get(codeHash, client_id) as any;

    if (!authCode) { res.status(400).json({ error: 'invalid_grant' }); return; }
    if (redirect_uri && authCode.redirect_uri !== redirect_uri) { res.status(400).json({ error: 'invalid_grant', description: 'redirect_uri mismatch' }); return; }

    // Delete used code
    db.prepare('DELETE FROM oauth_authorization_codes WHERE code_hash = ?').run(codeHash);

    // Generate tokens
    const accessToken = jwt.sign(
      { sub: authCode.user_id, client_id, scope: authCode.scope, type: 'access' },
      JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL }
    );
    const refreshTokenValue = randomBytes(32).toString('hex');

    // Store tokens
    const accessTokenHash = createHash('sha256').update(accessToken).digest('hex');
    const refreshTokenHash = createHash('sha256').update(refreshTokenValue).digest('hex');
    const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL * 1000).toISOString();
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000).toISOString();

    const accessTokenId = randomUUID();
    db.prepare('INSERT INTO oauth_access_tokens (id, token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(accessTokenId, accessTokenHash, client_id, authCode.user_id, authCode.scope, accessExpiresAt);
    db.prepare('INSERT INTO oauth_refresh_tokens (id, token_hash, access_token_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), refreshTokenHash, accessTokenId, refreshExpiresAt);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL,
      refresh_token: refreshTokenValue,
      scope: authCode.scope,
    });
    return;
  }

  if (grant_type === 'refresh_token') {
    if (!refresh_token) { res.status(400).json({ error: 'invalid_request' }); return; }

    const tokenHash = createHash('sha256').update(refresh_token).digest('hex');
    const stored = db.prepare(
      "SELECT rt.*, at.user_id, at.client_id, at.scope FROM oauth_refresh_tokens rt JOIN oauth_access_tokens at ON rt.access_token_id = at.id WHERE rt.token_hash = ? AND rt.expires_at > datetime('now') AND rt.revoked_at IS NULL"
    ).get(tokenHash) as any;

    if (!stored) { res.status(400).json({ error: 'invalid_grant' }); return; }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { sub: stored.user_id, client_id: stored.client_id, scope: stored.scope, type: 'access' },
      JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL }
    );
    const newHash = createHash('sha256').update(newAccessToken).digest('hex');
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL * 1000).toISOString();

    const newId = randomUUID();
    db.prepare('INSERT INTO oauth_access_tokens (id, token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(newId, newHash, stored.client_id, stored.user_id, stored.scope, expiresAt);

    // Update refresh token to point to new access token
    db.prepare('UPDATE oauth_refresh_tokens SET access_token_id = ? WHERE token_hash = ?').run(newId, tokenHash);

    res.json({ access_token: newAccessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL, scope: stored.scope });
    return;
  }

  res.status(400).json({ error: 'unsupported_grant_type' });
});

// GET /oauth/userinfo — user profile
oauthProviderRouter.get('/oauth/userinfo', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'invalid_token' }); return; }

  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    const db = getDb();
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(decoded.sub) as any;
    if (!user) { res.status(404).json({ error: 'user_not_found' }); return; }

    res.json({ sub: user.id, name: user.name, email: user.email || null, picture: null });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
});
