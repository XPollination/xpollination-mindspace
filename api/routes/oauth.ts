import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const oauthRouter = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || '';

// Conditionally register Google strategy if credentials are configured
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    (_accessToken, _refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName || '';
      const googleId = profile.id;

      if (!email) {
        return done(new Error('No email in Google profile'));
      }

      const db = getDb();

      // Find or create user by email
      let user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) as any;

      if (user) {
        // Link google_id if not already set
        db.prepare('UPDATE users SET google_id = ? WHERE id = ? AND google_id IS NULL').run(googleId, user.id);
        done(null, user);
      } else {
        // Account not found — invite-only enforcement: do NOT auto-create users
        // User must register with an invite code first, then link Google account
        done(null, false, { message: 'Account not found. Register with an invite code first.' });
      }
    }
  ));
}

oauthRouter.use(passport.initialize());

// GET /google — initiate OAuth flow (guarded: returns 503 if strategy not registered)
oauthRouter.get('/google', (req: Request, res: Response, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Google OAuth not configured' });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

// GET /google/callback — handle OAuth callback (guarded)
oauthRouter.get('/google/callback',
  (req: Request, res: Response, next) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      res.status(503).json({ error: 'Google OAuth not configured' });
      return;
    }
    passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL || ''}/login?error=Account+not+found.+Register+with+an+invite+code+first.` })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as any;
    const secret = process.env.JWT_SECRET;

    if (!secret || !user) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      secret,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    // Set session cookie with SameSite=lax (allows OAuth redirect cookies)
    res.cookie('ms_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(FRONTEND_URL || '/');
  }
);

// GET /google/failure — dedicated OAuth failure route
oauthRouter.get('/google/failure', (_req: Request, res: Response) => {
  res.status(401).json({ error: 'Google OAuth authentication failed' });
});
