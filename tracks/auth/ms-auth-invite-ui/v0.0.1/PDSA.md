# PDSA: Invite Landing Page + Registration UI

**Task:** `ms-auth-invite-ui`
**Priority:** Medium
**Group:** AUTH
**Parent PDSA:** [ms-auth-e2e-design D4/D11](https://github.com/XPollination/xpollination-mindspace/blob/main/tracks/auth/ms-auth-e2e-design/v0.0.1/PDSA.md)
**Status:** Retroactive (implementation exists at commit 318196c)

## Context

The invite-only registration flow needs a user-facing landing page. When a user receives an invite link (e.g., `https://mindspace.xpollination.earth/invite/abc123`), they should land on a registration page with the invite code pre-filled. This is the friend-to-friend alpha onboarding experience.

## Design Decisions

### D1: `/invite/{code}` redirect to `/register?code={code}`

The Viz server handles `/invite/{code}` by redirecting (302) to `/register?code={code}`. This keeps the registration form as a single page while supporting both direct and invite-link access.

**Rationale:** Simpler than maintaining a separate invite page. The invite code is passed as a query parameter, readable by client-side JavaScript.

### D2: Invite code pre-fill from URL

`register.html` reads `?code=` from `window.location.search` and pre-fills the `invite_code` field. The field is editable (not readonly) to allow manual entry.

**Rationale:** Pre-filling reduces friction for invite recipients. Keeping it editable allows direct registration with a manually-shared code.

### D3: Form submits to `/api/auth/register`

Fields: `invite_code`, `name`, `email`, `password`. Posts as JSON to the API auth route which validates the invite code, creates the user, and marks the invite as used.

### D4: Auto-login after registration

On successful registration, immediately calls `/api/auth/login` with the same credentials. If login succeeds, the JWT cookie (`ms_session`) is set and user is redirected to `/` (dashboard). If login fails, redirect to `/login` after 1.5s.

**Rationale:** Eliminates the friction of registering then having to log in manually.

### D5: `/invite/` in PUBLIC_PATHS

Added to the Viz auth gate's PUBLIC_PATHS array so the invite URL is accessible without an existing session.

### D6: Styling consistent with login.html

Same dark theme (`#0d1117` background, `#161b22` card, `#30363d` borders, `#238636` CTA button). `.register-box` class mirrors `.login-box`.

### D7: Profile invite management deferred

DNA items 4-5 (view invite count, generate invite links, share button) are **deferred** — they require an authenticated dashboard UI which does not exist yet. This will be a separate follow-up task.

**Rationale:** The current scope covers the invite landing/registration flow. Profile management is a distinct feature requiring dashboard infrastructure.

## Acceptance Criteria

1. `/invite/{code}` redirects to `/register?code={code}` with `encodeURIComponent`
2. `/invite/` is in PUBLIC_PATHS (bypasses auth gate)
3. `register.html` pre-fills `invite_code` from URL `?code=` parameter
4. Form fields: invite_code, name, email, password
5. Form submits to `/api/auth/register` as JSON
6. On success: auto-login via `/api/auth/login` → redirect to `/`
7. On error: display error message inline
8. Styling matches login.html dark theme
9. Profile invite management is NOT in scope (deferred)

## Test Plan

1. Visit `/invite/test123` → verify redirect to `/register?code=test123`
2. Verify invite_code field pre-filled with `test123`
3. Submit registration with valid invite → verify account created + auto-login
4. Submit registration with invalid invite → verify error displayed
5. Submit registration with used invite → verify error displayed
6. Visit `/register` directly (no code) → verify empty invite_code field
7. Visual check: styling matches login page

## Verification (Retroactive)

Implementation verified at `viz/server.js` and `viz/versions/v0.0.25/register.html` (commit 318196c, feature/auth-e2e):
- AC1: ✅ `/invite/{code}` route at line 332 with `encodeURIComponent`
- AC2: ✅ `/invite/` in PUBLIC_PATHS at line 30
- AC3: ✅ `URLSearchParams` reads `code` param, sets `invite_code.value`
- AC4: ✅ Fields: invite_code, name, email, password
- AC5: ✅ `fetch('/api/auth/register', { method: 'POST', body: JSON.stringify(...) })`
- AC6: ✅ Auto-login via `/api/auth/login` → `window.location.href = '/'`
- AC7: ✅ Error element with `style.display = 'block'`
- AC8: ✅ Same `#0d1117`/`#161b22`/`#238636` theme
- AC9: ✅ No profile management implemented (deferred)
