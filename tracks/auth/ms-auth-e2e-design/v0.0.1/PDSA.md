# PDSA: End-to-End Auth Architecture (v0.0.1)

**Task:** `ms-auth-e2e-design`
**Version:** v0.0.1
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

The Viz dashboard (port 4100/4200) is completely open — no authentication layer. Anyone who can reach the URL sees all task data, can confirm tasks, request rework, and change settings. The API server (`api/server.ts`) has full auth infrastructure (JWT, bcrypt, OAuth, project access control) but nothing uses it. The systems are disconnected.

### Current State

**What exists:**
- API server: Express.js with `POST /api/auth/register`, `POST /api/auth/login`, Google OAuth, JWT signing (jsonwebtoken), bcrypt password hashing (cost 12), API key CRUD, project access control middleware
- Database: `users`, `api_keys`, `project_access` tables in `data/mindspace.db`
- Auth middleware: `requireApiKeyOrJwt`, `requireProjectAccess(minRole)` — written but not applied to routes
- Brain API: Separate auth (Bearer API key lookup, unhashed)

**What's missing:**
- Viz server has zero auth — all endpoints open, CORS `*`
- No login page in Viz
- No cookie/session management
- No invite system — registration is open
- Viz server (Node HTTP) and API server (Express) are separate processes
- No integration between Viz auth and API auth

### Architecture Overview

```
                         ┌──────────────────────────────────────┐
                         │         BROWSER (User)                │
                         └───────────┬──────────────────────────┘
                                     │
                         ┌───────────▼──────────────────────────┐
                         │     VIZ SERVER (viz/server.js)        │
                         │     Port 4100/4200                    │
                         │                                       │
                         │  ┌─────────────┐  ┌───────────────┐  │
                         │  │ Login Page   │  │ Dashboard     │  │
                         │  │ (static HTML)│  │ (auth gate)   │  │
                         │  └──────┬──────┘  └───────┬───────┘  │
                         │         │                  │          │
                         │         │  Auth Cookie     │ JWT      │
                         │         │  (httpOnly)      │ check    │
                         └─────────┼──────────────────┼──────────┘
                                   │                  │
                         ┌─────────▼──────────────────▼──────────┐
                         │     API SERVER (api/server.ts)         │
                         │     Port 3100                          │
                         │                                        │
                         │  POST /api/auth/login → JWT            │
                         │  POST /api/auth/register (invite-only) │
                         │  All routes: requireApiKeyOrJwt        │
                         │  Project routes: requireProjectAccess  │
                         └────────────────────────────────────────┘
```

### Design Decisions

**D1: Viz serves login page as auth gate.**

When a request hits Viz without a valid auth cookie, redirect to `/login`. The login page is static HTML served by Viz (no server-side rendering).

```
GET /anything → check ms_session cookie → if invalid → redirect /login
GET /login → serve static login.html (no auth required)
GET /assets/* → serve static assets (no auth required)
POST /api/auth/login → proxy to API server
```

Login page submits credentials to Viz, which proxies to API server and sets httpOnly cookie on response.

**D2: JWT stored as httpOnly cookie.**

After successful login, Viz sets the JWT as an httpOnly, Secure, SameSite=Strict cookie named `ms_session`.

```javascript
// Viz sets cookie on successful login proxy
res.setHeader('Set-Cookie', [
  `ms_session=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
]);
```

Why httpOnly: prevents XSS from stealing the token. Why SameSite=Strict: prevents CSRF.

**D3: Viz auth middleware — cookie extraction + JWT verification.**

New middleware for viz/server.js that:
1. Extracts `ms_session` cookie from request
2. Verifies JWT using shared `JWT_SECRET`
3. If valid: attach user info to request, proceed
4. If invalid/missing: redirect to `/login` (for page requests) or return 401 (for API requests)

```javascript
// Public paths (no auth required)
const PUBLIC_PATHS = ['/login', '/assets/', '/api/auth/', '/health'];

function requireAuth(req, res) {
    if (PUBLIC_PATHS.some(p => req.url.startsWith(p))) return true;

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies['ms_session'];
    if (!token) return redirectLogin(res);

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        return true;
    } catch {
        // Clear stale cookie
        res.setHeader('Set-Cookie', 'ms_session=; HttpOnly; Max-Age=0; Path=/');
        return redirectLogin(res);
    }
}
```

**D4: Invite-only registration.**

No public registration. New `invites` table:

```sql
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,              -- UUID
    code TEXT UNIQUE NOT NULL,        -- random invite code
    created_by TEXT NOT NULL REFERENCES users(id),
    used_by TEXT REFERENCES users(id),
    used_at TEXT,
    expires_at TEXT NOT NULL,         -- 7 days from creation
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Each user gets N invites (configurable)
-- Default: 3 invites per user
```

Flow:
1. Existing user generates invite: `POST /api/invites` → returns `{ code: "xpo_inv_..." }`
2. User shares invite link: `https://mindspace.xpollination.earth/register?code=xpo_inv_...`
3. Viz serves registration page with invite code pre-filled
4. Registration: `POST /api/auth/register` with `{ email, name, password, invite_code }`
5. API validates invite code (not expired, not used), creates user, marks invite as used
6. Returns JWT, Viz sets cookie

**D5: Invite quota enforcement.**

```sql
-- Check remaining invites for a user
SELECT
    (SELECT COUNT(*) FROM invites WHERE created_by = ? AND used_at IS NULL AND expires_at > datetime('now')) as pending,
    (SELECT COUNT(*) FROM invites WHERE created_by = ?) as total
```

Default quota: 3 invites per user. Configurable via `INVITE_QUOTA` env var or `users.invite_quota` column.

**D6: Logout clears session.**

```
POST /api/auth/logout → Viz clears ms_session cookie
```

Response: `Set-Cookie: ms_session=; HttpOnly; Max-Age=0; Path=/; SameSite=Strict`

No server-side session invalidation needed — JWT is stateless. Token becomes invalid after Max-Age expires or cookie is cleared.

**D7: Viz proxies auth requests to API server.**

Viz (port 4100/4200) proxies auth endpoints to API server (port 3100):

```
POST /api/auth/login    → proxy to http://localhost:3100/api/auth/login
POST /api/auth/register → proxy to http://localhost:3100/api/auth/register
POST /api/auth/logout   → handle locally (clear cookie)
POST /api/invites       → proxy to http://localhost:3100/api/invites
```

Viz adds `Set-Cookie` header on successful login/register proxy responses.

**D8: API server routes get auth middleware.**

Apply `requireApiKeyOrJwt` to all existing API routes that currently lack it:

```typescript
// api/server.ts
app.use('/api/keys', requireApiKeyOrJwt, keysRouter);
app.use('/api/projects', requireApiKeyOrJwt, projectsRouter);
// auth routes remain public
```

Agent CLI access (via `interface-cli.js`) uses API keys, not JWT. This already works via `X-Api-Key` header or `Authorization: Bearer <api_key>`.

**D9: Shared JWT_SECRET between Viz and API.**

Both servers need the same `JWT_SECRET` to sign/verify tokens. Set via environment variable. The API server already reads `JWT_SECRET`. Viz reads the same env var.

**D10: Login page design — minimal, functional.**

```html
<!-- /viz/active/login.html -->
<form id="login-form">
    <h1>Mindspace</h1>
    <input type="email" name="email" placeholder="Email" required>
    <input type="password" name="password" placeholder="Password" required>
    <button type="submit">Sign In</button>
    <div id="error" hidden></div>
</form>
<script>
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: form.get('email'),
                password: form.get('password')
            })
        });
        if (res.ok) window.location.href = '/';
        else document.getElementById('error').textContent = 'Invalid credentials';
    };
</script>
```

**D11: Registration page — invite-gated.**

```html
<!-- /viz/active/register.html -->
<form id="register-form">
    <h1>Join Mindspace</h1>
    <input type="hidden" name="invite_code" value="<from URL>">
    <input type="email" name="email" placeholder="Email" required>
    <input type="text" name="name" placeholder="Display Name" required>
    <input type="password" name="password" placeholder="Password (8+ chars)" required>
    <button type="submit">Create Account</button>
</form>
```

If invite code is invalid/expired, show error message instead of form.

**D12: First user bootstrap.**

On fresh install, no users exist. Create system admin via CLI:

```bash
node api/scripts/create-admin.js --email thomas@xpollination.earth --name "Thomas Pichler" --password "..."
```

This bypasses invite requirement. Sets `is_system_admin = 1`.

**D13: CORS lockdown.**

Replace `Access-Control-Allow-Origin: *` in viz/server.js with the actual frontend origin:

```javascript
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['https://mindspace.xpollination.earth'];
```

For dev environment (port 4200), include `http://10.33.33.1:4200`.

### Data Flow Diagrams

**Login Flow:**
```
Browser                  Viz (4100)              API (3100)
   │                        │                        │
   ├─ GET / ────────────────►                        │
   │                        ├─ no cookie ──► redirect │
   ◄─ 302 /login ──────────┤                        │
   │                        │                        │
   ├─ GET /login ───────────►                        │
   ◄─ login.html ───────────┤                        │
   │                        │                        │
   ├─ POST /api/auth/login ─►                        │
   │                        ├─ proxy ────────────────►
   │                        │                        ├─ verify password
   │                        │                        ├─ sign JWT
   │                        ◄─ { token, user } ──────┤
   │                        ├─ Set-Cookie: ms_session │
   ◄─ 200 OK + cookie ──────┤                        │
   │                        │                        │
   ├─ GET / (with cookie) ──►                        │
   │                        ├─ verify JWT ─► OK       │
   ◄─ dashboard.html ───────┤                        │
```

**Invite Flow:**
```
Admin                    Viz/API                 New User
  │                        │                        │
  ├─ POST /api/invites ────►                        │
  ◄─ { code } ─────────────┤                        │
  │                        │                        │
  ├─ share link ───────────────────────────────────►│
  │                        │                        │
  │                        ◄─ GET /register?code ───┤
  │                        ├─ register.html ────────►
  │                        │                        │
  │                        ◄─ POST /api/auth/register
  │                        ├─ validate code          │
  │                        ├─ create user            │
  │                        ├─ mark invite used       │
  │                        ├─ sign JWT               │
  │                        ├─ Set-Cookie ────────────►
  │                        │              logged in   │
```

### Migration Plan

**New migration file: `api/db/migrations/008-invites.sql`**

```sql
CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    used_at TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_created_by ON invites(created_by);

-- Add invite quota to users
ALTER TABLE users ADD COLUMN invite_quota INTEGER DEFAULT 3;
```

### Task Decomposition (Suggested Implementation Order)

| # | Task | Scope | Dependencies |
|---|------|-------|-------------|
| 1 | Viz auth middleware | `viz/server.js` — cookie check, redirect, JWT verify | JWT_SECRET env var |
| 2 | Login page | `viz/active/login.html` — form, fetch, error handling | None |
| 3 | Login proxy | `viz/server.js` — proxy POST /api/auth/login to API, set cookie | API server running |
| 4 | Logout endpoint | `viz/server.js` — POST /api/auth/logout clears cookie | Task 1 |
| 5 | Invites migration | `api/db/migrations/008-invites.sql` | None |
| 6 | Invite routes | `api/routes/invites.ts` — CRUD, quota check | Task 5 |
| 7 | Registration gate | Modify `api/routes/auth.ts` — require invite_code | Task 5 |
| 8 | Registration page | `viz/active/register.html` — invite-gated form | Task 7 |
| 9 | Admin bootstrap script | `api/scripts/create-admin.js` | None |
| 10 | CORS lockdown | `viz/server.js` — restrict origins | Task 1 |
| 11 | API route protection | `api/server.ts` — apply requireApiKeyOrJwt to all routes | None |

Tasks 1-4 form the login gate MVP. Tasks 5-8 add invite system. Tasks 9-11 are hardening.

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `viz/server.js` | **MODIFY** | Auth middleware, login proxy, logout, CORS |
| `viz/active/login.html` | **CREATE** | Login page |
| `viz/active/register.html` | **CREATE** | Registration page |
| `api/db/migrations/008-invites.sql` | **CREATE** | Invites table + user quota |
| `api/routes/invites.ts` | **CREATE** | Invite CRUD endpoints |
| `api/routes/auth.ts` | **MODIFY** | Require invite_code on register |
| `api/server.ts` | **MODIFY** | Apply auth middleware to routes |
| `api/scripts/create-admin.js` | **CREATE** | Bootstrap first admin user |

### Verification Plan

1. `curl -s http://localhost:4200/` without cookie → 302 redirect to /login
2. `curl -s http://localhost:4200/login` → login.html served
3. Login with valid credentials → ms_session cookie set, redirect to /
4. Access dashboard with valid cookie → 200 OK with data
5. Access `/api/data` with expired/invalid cookie → 401
6. `POST /api/auth/register` without invite_code → 400
7. `POST /api/invites` → returns invite code
8. Register with valid invite code → account created, cookie set
9. Register with used/expired invite code → 400
10. Logout → cookie cleared, redirect to /login
11. API routes return 401 without auth header
12. CORS rejects requests from unauthorized origins

### Risks

**R1: Viz is plain Node HTTP, not Express.** Cannot use Express middleware. Must implement cookie parsing, proxy, and auth check as plain functions. More code but no new dependencies needed (jsonwebtoken already in API deps — Viz needs it too or verifies via API call).

**R2: JWT_SECRET must be shared.** Both Viz and API need the same secret. If they run as separate processes, the env var must be set for both. Docker Compose or systemd service files must propagate it.

**R3: Cookie not sent cross-origin.** If Viz and API are on different ports (4200 vs 3100), the browser treats them as different origins. SameSite=Strict cookies won't be sent cross-origin. Solution: Viz proxies API requests so everything goes through one origin (port 4200).

**R4: First user chicken-and-egg.** No users exist on fresh install, can't generate invites without a user. Bootstrap script solves this.

**R5: Agent CLI access.** Agents use `interface-cli.js` which talks to the DB directly, not the API. Agent access is unaffected by API auth. Brain API uses its own key-based auth. No changes needed for agent workflow.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
