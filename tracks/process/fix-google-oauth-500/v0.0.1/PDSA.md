# PDSA: Fix Google OAuth 500 on API Server

**Task:** `fix-google-oauth-500`
**Version:** v0.0.1
**Status:** Design

## Plan

### Root Cause Analysis

`api/routes/oauth.ts` line 16: Google strategy is registered **only if** `GOOGLE_CLIENT_ID` AND `GOOGLE_CLIENT_SECRET` env vars are set. Line 53: `passport.authenticate('google')` is called unconditionally — if strategy isn't registered, passport throws 500.

**Why it works manually but not as systemd**: Manual run has env vars loaded from shell profile. Systemd service may not have `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in its environment.

### Two-Part Fix

#### Part 1: Graceful handling when OAuth not configured (oauth.ts)

Add a guard before `passport.authenticate('google')` on line 53:

```typescript
// Before the passport.authenticate call, check if strategy is registered
oauthRouter.get('/google', (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Google OAuth not configured' });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});
```

This prevents the unhandled 500 and returns a clear error message.

#### Part 2: Ensure systemd service has env vars

Check `/etc/systemd/system/mindspace-api.service` for `EnvironmentFile` or `Environment` directives. The service needs:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL`
- `JWT_SECRET`

If using `EnvironmentFile`, verify the file exists and contains these vars.

### Schema Check

Migration 005 adds `google_id` column to users table. This must be applied on the API DB. If the systemd service uses a different DB path than the manual run, the migration may not have been applied.

## Do

DEV fixes:
1. `api/routes/oauth.ts`: Add guard on `/google` route — return 503 if strategy not registered
2. Verify systemd service `EnvironmentFile` includes OAuth env vars
3. Run migrations on the API DB used by systemd

## Study

Verify:
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/api/auth/oauth/google` returns 302 (not 500)
- If env vars missing: returns 503 with clear message (not 500)
- OAuth callback creates session correctly

## Act

### Design Decisions
1. **503 not 500**: Unconfigured OAuth is a service unavailable state, not an internal error
2. **Guard pattern**: Check env vars before passport.authenticate, don't rely on passport error handling
3. **Both parts needed**: Code fix + systemd env fix. Code fix alone handles the symptom, env fix resolves the cause
