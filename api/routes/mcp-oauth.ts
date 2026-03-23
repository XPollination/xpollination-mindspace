/**
 * MCP OAuth 2.1 Authorization Server
 *
 * Implements OAuthServerProvider from the MCP SDK so that Claude.ai (and other
 * MCP clients) can authenticate via browser-based OAuth flow.
 *
 * Flow: Client → 401 → discover metadata → /authorize → user login → consent
 *       → callback with code → /token → access_token → MCP requests
 *
 * Uses Mindspace's existing user/auth system. No new identity provider needed.
 */

import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';

import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull, OAuthTokens, OAuthTokenRevocationRequest } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mindspace.xpollination.earth';
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour
const REFRESH_EXPIRY_SECONDS = 30 * 24 * 3600; // 30 days
const CODE_EXPIRY_SECONDS = 600; // 10 minutes

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// --- Clients Store ---

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId) as any;
    if (!row) return undefined;
    return {
      client_id: row.client_id,
      client_name: row.client_name,
      redirect_uris: JSON.parse(row.redirect_uris),
      grant_types: JSON.parse(row.grant_types),
      scope: row.scope || undefined,
      client_uri: row.client_uri || undefined,
      client_id_issued_at: Math.floor(new Date(row.created_at).getTime() / 1000),
    } as OAuthClientInformationFull;
  },

  registerClient(client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>): OAuthClientInformationFull {
    const db = getDb();
    const clientId = randomUUID();
    const clientSecret = randomBytes(32).toString('hex');
    const secretHash = hashToken(clientSecret);

    db.prepare(
      'INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris, grant_types, scope, client_uri) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      clientId,
      secretHash,
      client.client_name || 'MCP Client',
      JSON.stringify(client.redirect_uris || []),
      JSON.stringify(client.grant_types || ['authorization_code']),
      client.scope || null,
      (client as any).client_uri || null,
    );

    return {
      ...client,
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    } as OAuthClientInformationFull;
  },
};

// --- OAuth Server Provider ---

export const mindspaceOAuthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    // Generate authorization code and store it
    // For now, we auto-approve for any authenticated user (consent screen is a future iteration)
    // The user must already be logged in (ms_session cookie) to reach this point

    const req = (res as any).req;
    const cookies = parseCookies(req);
    const sessionToken = cookies.ms_session;

    if (!sessionToken) {
      // User not logged in — redirect to login with return URL
      const authorizeUrl = req.originalUrl || req.url;
      res.redirect(`${FRONTEND_URL}/login?return_to=${encodeURIComponent(authorizeUrl)}`);
      return;
    }

    // Validate JWT
    let user: any;
    try {
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;
      user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    } catch {
      res.redirect(`${FRONTEND_URL}/login?error=Session+expired`);
      return;
    }

    // Generate authorization code
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_SECONDS * 1000).toISOString();

    const db = getDb();
    db.prepare(
      'INSERT INTO oauth_authorization_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(code, client.client_id, user.id, params.redirectUri, params.codeChallenge, 'S256', params.scopes?.join(' ') || null, expiresAt);

    // Redirect back to client with code
    const redirectUrl = new URL(params.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (params.state) redirectUrl.searchParams.set('state', params.state);
    res.redirect(redirectUrl.toString());
  },

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const db = getDb();
    const row = db.prepare('SELECT code_challenge FROM oauth_authorization_codes WHERE code = ? AND used = 0').get(authorizationCode) as any;
    if (!row) throw new Error('Invalid or expired authorization code');
    return row.code_challenge;
  },

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string, _codeVerifier?: string, _redirectUri?: string, _resource?: URL): Promise<OAuthTokens> {
    const db = getDb();

    // Look up and validate authorization code
    const codeRow = db.prepare(
      `SELECT * FROM oauth_authorization_codes WHERE code = ? AND client_id = ? AND used = 0 AND expires_at > datetime('now')`
    ).get(authorizationCode, client.client_id) as any;

    if (!codeRow) throw new Error('Invalid, expired, or already used authorization code');

    // Mark code as used
    db.prepare('UPDATE oauth_authorization_codes SET used = 1 WHERE code = ?').run(authorizationCode);

    // Generate tokens
    const accessToken = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(32).toString('hex');
    const accessExpiry = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000).toISOString();
    const refreshExpiry = new Date(Date.now() + REFRESH_EXPIRY_SECONDS * 1000).toISOString();

    db.prepare(
      'INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(hashToken(accessToken), client.client_id, codeRow.user_id, codeRow.scope, accessExpiry);

    db.prepare(
      'INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, access_token_hash, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(hashToken(refreshToken), client.client_id, codeRow.user_id, hashToken(accessToken), codeRow.scope, refreshExpiry);

    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: TOKEN_EXPIRY_SECONDS,
      refresh_token: refreshToken,
      scope: codeRow.scope || undefined,
    };
  },

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], _resource?: URL): Promise<OAuthTokens> {
    const db = getDb();
    const refreshHash = hashToken(refreshToken);

    const row = db.prepare(
      `SELECT * FROM oauth_refresh_tokens WHERE token_hash = ? AND client_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
    ).get(refreshHash, client.client_id) as any;

    if (!row) throw new Error('Invalid or expired refresh token');

    // Revoke old access token
    db.prepare(`UPDATE oauth_access_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`).run(row.access_token_hash);

    // Generate new access token
    const newAccessToken = randomBytes(32).toString('hex');
    const accessExpiry = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000).toISOString();
    const scope = scopes?.join(' ') || row.scope;

    db.prepare(
      'INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(hashToken(newAccessToken), client.client_id, row.user_id, scope, accessExpiry);

    // Update refresh token to point to new access token
    db.prepare('UPDATE oauth_refresh_tokens SET access_token_hash = ? WHERE token_hash = ?').run(hashToken(newAccessToken), refreshHash);

    return {
      access_token: newAccessToken,
      token_type: 'bearer',
      expires_in: TOKEN_EXPIRY_SECONDS,
      scope: scope || undefined,
    };
  },

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const db = getDb();
    const tokenHash = hashToken(token);

    const row = db.prepare(
      `SELECT * FROM oauth_access_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
    ).get(tokenHash) as any;

    if (!row) throw new Error('Invalid or expired access token');

    return {
      token,
      clientId: row.client_id,
      scopes: row.scope ? row.scope.split(' ') : [],
      expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
      extra: { user_id: row.user_id },
    };
  },

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const db = getDb();
    const tokenHash = hashToken(request.token);

    // Try access token first
    const accessResult = db.prepare(
      `UPDATE oauth_access_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND client_id = ?`
    ).run(tokenHash, client.client_id);

    if (accessResult.changes === 0) {
      // Try refresh token
      db.prepare(
        `UPDATE oauth_refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND client_id = ?`
      ).run(tokenHash, client.client_id);
    }
  },
};

// --- Helper ---

function parseCookies(req: any): Record<string, string> {
  const header = req.headers?.cookie || '';
  const cookies: Record<string, string> = {};
  header.split(';').forEach((pair: string) => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  });
  return cookies;
}
