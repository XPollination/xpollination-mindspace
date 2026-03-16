# Changelog: ms-auth-invite-ui v0.0.2

## Summary
Invite landing page + registration UI at /invite/{code} with auto-login flow.

## Changes
- /invite/{code} route in viz/server.js redirects to /register?code={code} with encodeURIComponent
- /invite/ added to PUBLIC_PATHS to bypass auth gate
- register.html pre-fills invite_code from URL ?code= param (readonly)
- Form posts to /api/auth/register, auto-login via /api/auth/login on success
- Styling consistent with login.html (dark theme, green CTA)
- Profile invite management (DNA items 4-5) deferred — requires dashboard UI

## Commits
- xpollination-mcp-server: 318196c (feature/auth-e2e)

## Verification
- 13/13 tests pass (ms-auth-invite-ui.test.ts)
- QA: PASS
- PDSA: PASS (retroactive v0.0.2)
