# PDSA: Fix Google OAuth 500 + Session Persistence

**Task:** `auth-session-and-oauth-fix`
**Version:** v0.0.1
**Status:** Design

## Plan

### Bug 1: OAuth 500 (env vars present but passport crashes)

**Root cause investigation:** The 503 guard (from `fix-google-oauth-500`) checks `GOOGLE_CLIENT_ID` — it IS set. So `passport.authenticate('google')` is called, but crashes internally. Likely causes:
- Callback URL mismatch (GOOGLE_CALLBACK_URL doesn't match Google Cloud Console config)
- Google Cloud OAuth credentials expired or misconfigured
- passport.initialize() not called before passport.authenticate()

**Fix:**
1. Wrap `passport.authenticate('google')` in try/catch in `oauth.ts`
2. Log the actual error to stderr (currently crashes silently)
3. If the Google strategy throws, return 503 with the error message instead of 500
4. Add a `/api/auth/oauth/status` endpoint that returns whether Google OAuth is configured AND functioning

```typescript
// oauth.ts line 53 — replace direct passport.authenticate
oauthRouter.get('/google', (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  try {
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(503).json({ error: 'Google OAuth initialization failed', detail: err.message });
  }
});
```

5. In viz login.html: if `/api/auth/oauth/status` returns `{ google: false }`, hide or disable the Google button with message "Google Sign-in not available"

### Bug 2: Session expires too fast

**Root cause:** `JWT_EXPIRY='15m'` (auth.ts line 53) + no Max-Age on cookie (server.js line 300) + no refresh mechanism in viz.

**Fix (simplest approach — extend JWT lifetime):**
1. Change `JWT_EXPIRY` default from `'15m'` to `'7d'` in auth.ts
2. Add `Max-Age=604800` (7 days) to the `Set-Cookie` header in viz/server.js line 300
3. OAuth callback cookie (oauth.ts line 74) already has `maxAge: 7 * 24 * 60 * 60 * 1000` — consistent

```javascript
// viz/server.js line 300 — add Max-Age
`ms_session=${data.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`
```

**Why not refresh tokens (yet):** Refresh token mechanism exists in the API but the viz client (vanilla JS) doesn't have the plumbing. Adding it requires: intercepting 401 responses, calling `/api/auth/refresh`, storing the refresh_token in a separate cookie. This is a larger change. Extending JWT to 7 days solves the immediate pain.

### Files to Modify

| File | Change |
|------|--------|
| `api/routes/oauth.ts` | try/catch around passport.authenticate, log errors |
| `api/routes/auth.ts` | Change JWT_EXPIRY default to '7d' |
| `viz/server.js` line 300 | Add Max-Age=604800 to ms_session cookie |
| `viz/versions/v0.0.35/login.html` | Conditionally show/hide Google button based on /api/auth/oauth/status |

## Do

DEV implements the 4 changes above. No schema changes needed.

## Study

Verify:
- Google OAuth: click button → if working: Google consent → redirect → logged in; if not working: button disabled with message
- Session: login → close browser → reopen → still logged in (cookie persists)
- Session: login → wait 24h → still logged in (JWT not expired)
- Logout: click logout → cookie cleared → redirected to login

## Act

### Design Decisions
1. **7-day JWT over refresh tokens**: Simpler, solves immediate pain. Refresh can be added later.
2. **Error logging over silent crash**: passport errors must be visible in stderr for debugging.
3. **OAuth status endpoint**: Lets the viz disable the button gracefully instead of showing 500 after click.
4. **Max-Age matches JWT**: Cookie and token expire at the same time. No orphaned cookies.
