# PDSA: Agent Continuity — Full Hive Stack (v0.0.3)

**Task:** `agent-continuity-recovery`
**Version:** v0.0.3
**Date:** 2026-03-13
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Agents lose working context on compact/clear/restart. Recovery today is broken: generic brain queries return role definitions (not task state), thought previews are truncated (~120 chars), and agents proceed without verifying their understanding. Humans must manually guide agents back to context — an art most humans don't have.

**Observed failure (2026-03-13):** LIAISON completed mindspace-docker-installer but lost 5 pending items. Without Thomas asking "do you still have the context?", the agent would have declared "all done."

**Root causes:**
- Brain stores insights, not working memory — session state doesn't fit the knowledge accumulation model
- Recovery queries are generic ("recovery for liaison") — returns role definitions, not task state
- No recovery self-test — agent proceeds without verifying understanding
- Auto-compact has no pre-save trigger — working context is lost before recovery captures it
- Ad-hoc work has no DNA — only formal PM tasks are recoverable

### Architecture Principle

**Brain is the root.** An agent needs only `brain_url` + `agent_id` + HTTP. Everything else — identity, state, context — comes from brain. Works for Claude, GPT, Gemini, local LLMs, any future platform.

**One URL:** `hive.xpollination.earth` is the single URL a human gives to any new agent. From that URL, the agent learns who it is, what it was doing, what the human expects, and how to connect for ongoing memory.

### Domain Architecture

| Domain | Service | Purpose |
|--------|---------|---------|
| `mindspace.xpollination.earth` | PM tool (API port 3100, Viz port 4200) | Human-facing — missions, capabilities, tasks, kanban |
| `hive.xpollination.earth` | Brain API (port 3200) | Agent-facing — identity, memory, A2A protocol |

Both run on Hetzner CX22 (same server). nginx reverse proxy differentiates by subdomain, provides HTTPS.

### Current Brain API

The Brain API (Fastify + Qdrant + SQLite at port 3200) currently supports:
- `POST /api/v1/memory` — contribute and retrieve thoughts (long-term knowledge)
- `GET /api/v1/memory/thought/:id` — drill down to full thought
- `GET /api/v1/health` — health check
- Bearer token auth via `users` table in SQLite (`thought-tracing.db`)
- Pheromone-weighted retrieval with category scoring
- Multi-user support via per-user Qdrant collections

**What's missing:** Working memory (agent state), identity store (role definitions), recovery endpoint, onboarding page.

### Target: What This Task Delivers

After implementation, hive.xpollination.earth provides:

1. **Onboarding page** — human-readable landing page with XPollination branding and API documentation
2. **Recovery endpoint** — one HTTP call returns identity + working state + key context
3. **Working memory** — agents continuously push their current state (survives crashes)
4. **Identity store** — role, responsibilities, recovery protocol per agent_id
5. **Secure access** — HTTPS, per-agent API keys, rate limiting
6. **Full end-to-end flow** — agent receives URL → connects → identifies → recovers → self-tests → resumes

---

### Design Decisions

#### D1: DNS Records

| Subdomain | Type | Target |
|-----------|------|--------|
| `mindspace.xpollination.earth` | A | Hetzner CX22 public IP |
| `hive.xpollination.earth` | A | Hetzner CX22 public IP |

Both point to the same server. nginx differentiates by `server_name`.

#### D2: nginx Reverse Proxy with HTTPS

Two server blocks + HTTP→HTTPS redirect:

```nginx
# /etc/nginx/sites-available/hive.xpollination.earth
server {
    listen 443 ssl;
    server_name hive.xpollination.earth;

    ssl_certificate /etc/letsencrypt/live/hive.xpollination.earth/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hive.xpollination.earth/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# /etc/nginx/sites-available/mindspace.xpollination.earth
server {
    listen 443 ssl;
    server_name mindspace.xpollination.earth;

    ssl_certificate /etc/letsencrypt/live/mindspace.xpollination.earth/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mindspace.xpollination.earth/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /viz/ {
        proxy_pass http://127.0.0.1:4200/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# HTTP → HTTPS redirect for both
server {
    listen 80;
    server_name mindspace.xpollination.earth hive.xpollination.earth;
    return 301 https://$host$request_uri;
}
```

Bearer tokens travel in cleartext without TLS. HTTPS is mandatory before any public exposure.

#### D3: Let's Encrypt via certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mindspace.xpollination.earth
sudo certbot --nginx -d hive.xpollination.earth
```

DNS must resolve to Hetzner IP before certbot runs (HTTP-01 challenge). Auto-renewal via systemd timer.

#### D4: Firewall

```bash
sudo ufw allow 80/tcp    # certbot + redirect
sudo ufw allow 443/tcp   # HTTPS
```

Internal ports (3100, 3200, 4200) stay internal — nginx proxies to them.

**Note:** All sudo commands require `thomas` user via `sshpass`.

#### D5: Per-Agent API Keys

Current: all agents share one `BRAIN_API_KEY`. Target: each agent gets its own revocable key.

The `users` table in `thought-tracing.db` already supports per-user API keys. Insert 4 agent rows:

```sql
INSERT INTO users (user_id, display_name, api_key, qdrant_collection)
VALUES
  ('agent-liaison', 'LIAISON Agent', '<uuid-1>', 'thought_space'),
  ('agent-pdsa', 'PDSA Agent', '<uuid-2>', 'thought_space'),
  ('agent-dev', 'DEV Agent', '<uuid-3>', 'thought_space'),
  ('agent-qa', 'QA Agent', '<uuid-4>', 'thought_space');
```

All share `thought_space` collection (shared knowledge). Keys differ for revocability and audit.

**Key distribution:** `claude-session.sh` sets `BRAIN_API_KEY` per tmux pane. Each pane gets its agent-specific key.

**Backward compat:** Thomas's existing key (`thomas` user) continues to work.

#### D6: Rate Limiting via nginx

```nginx
# In http block (/etc/nginx/nginx.conf)
limit_req_zone $http_authorization zone=brain_api:10m rate=60r/m;

# In hive server block
location / {
    limit_req zone=brain_api burst=10 nodelay;
    proxy_pass http://127.0.0.1:3200;
    ...
}
```

60 requests/minute per API key. Burst of 10 allows short spikes. nginx returns 429 when exceeded. No application code change.

#### D7: Working Memory Table (SQLite)

New table in `thought-tracing.db`:

```sql
CREATE TABLE IF NOT EXISTS agent_state (
  agent_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_id TEXT,
  ttl_hours INTEGER DEFAULT 72
);
CREATE INDEX IF NOT EXISTS idx_agent_state_updated ON agent_state(updated_at);
```

`state_json` is freeform JSON. Expected structure:

```json
{
  "task_slug": "repo-consolidation-governance",
  "task_title": "Repo consolidation: governance, rename, script migration, archive",
  "step": "Rework v0.0.4 — scope refactored to D1-D7",
  "human_expectation": "Thomas wants clean scope, no hive drift",
  "pending_items": ["governance repo", "rename sequence", "script migration"],
  "key_decisions": ["hive work moved to agent-continuity-recovery"],
  "context_summary": "v0.0.1 had correct scope. v0.0.2-3 drifted into hive...",
  "ad_hoc_work": null
}
```

**Why SQLite, not Qdrant?** Working memory is structured (fixed schema), ephemeral (TTL, overwritten frequently), and looked up by exact key (agent_id) — not semantic similarity. SQLite is the right fit.

#### D8: Identity Store Table (SQLite)

```sql
CREATE TABLE IF NOT EXISTS agent_identity (
  agent_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  responsibilities TEXT NOT NULL,
  recovery_protocol TEXT NOT NULL,
  platform_hints TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Seed data for 4 agents:

| agent_id | role | Key responsibilities |
|----------|------|---------------------|
| `agent-liaison` | liaison | Bridge human↔agents. Creates tasks. Presents work. Executes human-decision transitions. Never does agent work. |
| `agent-pdsa` | pdsa | Plans, researches, designs. Produces PDSA docs. Reviews dev implementation. Never implements code. |
| `agent-dev` | dev | Implements what PDSA designed. Reads DNA, builds, submits for review. Never plans. Never changes tests. |
| `agent-qa` | qa | Writes tests from designs. Reviews dev by running tests. Never fixes implementation code. |

`recovery_protocol` is a multi-paragraph markdown with platform-agnostic recovery steps, including the mandatory self-test.

#### D9: Recovery Endpoint

```
GET /api/v1/recovery/:agentId
Authorization: Bearer <API_KEY>
```

Response:

```json
{
  "identity": {
    "agent_id": "agent-pdsa",
    "role": "pdsa",
    "display_name": "PDSA",
    "responsibilities": ["Plans, researches, designs...", "..."],
    "recovery_protocol": "## Step 1: Verify identity\n..."
  },
  "working_state": {
    "task_slug": "repo-consolidation-governance",
    "task_title": "...",
    "step": "...",
    "human_expectation": "...",
    "pending_items": ["..."],
    "updated_at": "2026-03-13T10:30:00Z",
    "age_minutes": 45,
    "stale": false
  },
  "key_context": [
    {
      "thought_id": "abc-123",
      "content": "Full thought content (not truncated)",
      "category": "transition_marker",
      "topic": "repo-consolidation-governance",
      "score": 0.92
    }
  ],
  "recent_transitions": ["TASK active→approval: PDSA repo-consolidation ..."],
  "degraded": false,
  "recovered_at": "2026-03-13T11:15:00Z"
}
```

**Implementation:**
1. Look up `agent_identity` by `agent_id` → 404 if not found
2. Look up `agent_state` → null if fresh agent (no working state)
3. Check TTL: if expired, return data with `stale: true`
4. Query Qdrant for top 5 thoughts by this contributor (transition_marker, state_snapshot, decision_record categories)
5. Fetch full content for top 3 (not 120-char previews)
6. Assemble response

**Graceful degradation:** If Qdrant is down, return identity + state with `degraded: true` and empty `key_context`. If SQLite is down, return 503.

#### D10: Working Memory Push Endpoint

```
POST /api/v1/working-memory/:agentId
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "session_id": "uuid",
  "state": { ... }
}
```

Max body size: 64KB. `INSERT OR REPLACE INTO agent_state` — entire state replaced atomically.

Response:

```json
{
  "success": true,
  "agent_id": "agent-pdsa",
  "updated_at": "2026-03-13T11:15:00Z",
  "previous_age_minutes": 45
}
```

**When to push (continuous sync events):**

| Event | When | What to include |
|-------|------|-----------------|
| `task_claimed` | Agent starts a task | task_slug, title, step="claimed" |
| `analysis_complete` | Finished research | findings summary, next step |
| `human_decision` | Human decides | what was decided, implications |
| `presentation` | About to present | what's being presented |
| `task_transition` | PM state change | from/to state, outcome |
| `ad_hoc_work` | Work outside PM | description, expected outcome |

Event-driven, not timer-based. Hard crash loses at most the last event.

#### D11: Onboarding Page

```
GET /
```

Returns a branded HTML page (no auth required). Readable by both humans and agents:

**Design:**
- XPollination logo (optimized WebP, sourced from HomePage image pipeline)
- Clear explanation of what the Hive is
- API documentation for agents
- Health check link

**Image pipeline:** The XPollination logo source is at `HomePage/images/xpollination/logo/XPollination.png` (1125×1112px, 1.9MB). The HomePage project uses `scripts/optimize-images.sh` with ImageMagick + cwebp to produce responsive sizes (480/768/1024px) in WebP format (92% smaller than PNG).

For the Hive onboarding page:
1. Generate a single optimized WebP at 256px width (~5KB) using `optimize-images.sh`
2. Store in `brain/public/assets/xpollination-logo-256.webp`
3. Include PNG fallback at same size: `brain/public/assets/xpollination-logo-256.png`
4. Serve via Fastify static file handler

**HTML structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XPollination Hive</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 720px; margin: 0 auto; padding: 2rem; color: #333; }
    .logo { display: block; margin: 0 auto 1rem; width: 128px; height: auto; }
    h1 { text-align: center; color: #1a1a2e; }
    .subtitle { text-align: center; color: #666; margin-bottom: 2rem; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .endpoint { margin: 1rem 0; padding: 0.5rem 1rem; border-left: 3px solid #4a90d9; }
  </style>
</head>
<body>
  <picture>
    <source srcset="/assets/xpollination-logo-256.webp" type="image/webp">
    <img src="/assets/xpollination-logo-256.png" alt="XPollination" class="logo"
         width="128" height="127" loading="eager">
  </picture>
  <h1>XPollination Hive</h1>
  <p class="subtitle">Agent identity, memory, and recovery endpoint</p>

  <h2>What is the Hive?</h2>
  <p>The Hive is where AI agents connect to discover who they are and recover their working context.
     When an agent starts fresh or loses context, it receives this URL from a human.
     One API call returns everything needed to resume work.</p>

  <h2>For Agents</h2>
  <div class="endpoint">
    <strong>1. Authenticate</strong><br>
    <code>Authorization: Bearer YOUR_API_KEY</code>
  </div>
  <div class="endpoint">
    <strong>2. Recover identity and state</strong><br>
    <code>GET /api/v1/recovery/{your_agent_id}</code>
  </div>
  <div class="endpoint">
    <strong>3. Push working state</strong><br>
    <code>POST /api/v1/working-memory/{your_agent_id}</code>
  </div>
  <div class="endpoint">
    <strong>4. Query and contribute knowledge</strong><br>
    <code>POST /api/v1/memory</code>
  </div>

  <h2>Health</h2>
  <p><a href="/api/v1/health">Check API health</a></p>
</body>
</html>
```

#### D12: TTL Cleanup Job

Run hourly alongside existing pheromone decay:

```sql
DELETE FROM agent_state
WHERE datetime(updated_at, '+' || ttl_hours || ' hours') < datetime('now');
```

Stale state (agent hasn't pushed in 72h) is deleted.

#### D13: BRAIN_API_URL Environment Variable

```bash
BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"
```

Update in:
- `.claude/skills/xpo.claude.monitor/SKILL.md` — all `curl` commands
- `scripts/hooks/xpo.claude.brain-first-hook.sh`
- `scripts/hooks/xpo.claude.brain-writeback-hook.sh`
- `scripts/hooks/xpo.claude.compact-recover.sh`

Local agents use localhost default. Remote agents override with `https://hive.xpollination.earth`.

#### D14: BRAIN_PUBLIC_URL in docker-compose

```yaml
brain:
  environment:
    - BRAIN_PUBLIC_URL=https://hive.xpollination.earth
```

Health endpoint includes this in response.

#### D15: Recovery Self-Test Protocol

The `recovery_protocol` stored in `agent_identity` includes this mandatory step:

```markdown
## Step 4: Self-Test (MANDATORY)

After receiving recovery data, present to the human:

"I recovered my context. Here's what I understand:
- **My role:** {role} — {responsibilities[0]}
- **Current task:** {working_state.task_slug} — {working_state.task_title}
- **Current step:** {working_state.step}
- **You expect:** {working_state.human_expectation}
- **Pending:** {working_state.pending_items}

Is this correct? Should I continue from here?"

Wait for human confirmation before proceeding.
If no working state exists, say:
"I have no working state. I'm a fresh agent. What should I work on?"
```

This is specified in the protocol, not enforced by the API (we can't force an LLM). Any agent implementation should follow it.

#### D16: Feature Branch Merge Plan

Current state: work is on `feature/wf-v18-approval-mode-enforcement`. For testing on the dev viz at `http://10.33.33.1:4200`, changes must reach the `develop` branch.

**Branch strategy for this task:**

1. **Brain API changes** (new routes, schema extensions) — implement on a new feature branch `feature/cap-hive-continuity` off `develop`
2. **Config changes** (BRAIN_API_URL env var, docker-compose) — same feature branch
3. **Infrastructure changes** (DNS, nginx, certbot, firewall) — not in git, executed on server
4. **Per-agent API keys** — SQL INSERT on live DB, not in git
5. **Onboarding page assets** — on the feature branch

**Merge flow:**

```
develop → feature/cap-hive-continuity (create)
           ↓ (implement brain API + config + onboarding)
           ↓ (QA tests on feature branch)
develop ← feature/cap-hive-continuity (merge after tests pass)
           ↓ (deploy to dev viz at :4200 via git pull on worktree)
           ↓ (verify end-to-end on :4200)
```

**What about existing feature branches?** The current `feature/wf-v18-approval-mode-enforcement` has 5 PDSA-only commits (design documents). These should be merged to develop first as they're non-breaking documentation. DEV should verify no conflicts before merging.

**Testing on dev viz (http://10.33.33.1:4200):**
- Dev viz runs the `develop` branch via a git worktree at `xpollination-mcp-server-test`
- After merging to develop: `cd xpollination-mcp-server-test && git pull`
- Brain API changes require restarting the brain service: `systemctl restart mindspace-test`
- Verify recovery endpoint works: `curl http://localhost:3200/api/v1/recovery/agent-pdsa`

**Testing on prod viz (http://10.33.33.1:4100):**
- Prod runs `main` branch. Thomas merges develop → main when satisfied.
- Not part of this task — Thomas handles main releases.

---

### Execution Order (5 Phases, 19 Steps)

**Phase 1: Branch Preparation (steps 1-2)**
1. Merge existing PDSA docs from `feature/wf-v18-approval-mode-enforcement` → `develop`
2. Create `feature/cap-hive-continuity` branch off `develop`

**Phase 2: Brain API Implementation (steps 3-9)**
3. Extend `database.ts` — add `agent_state` and `agent_identity` tables with seed data
4. Add TypeScript interfaces — `AgentState`, `AgentIdentity`, `RecoveryResponse`
5. Add `getRecentByContributor()` to `thoughtspace.ts`
6. Create `recovery.ts` route — `GET /api/v1/recovery/:agentId`
7. Create `working-memory.ts` route — `POST /api/v1/working-memory/:agentId`
8. Create `onboarding.ts` route — `GET /` with branded HTML + optimized logo
9. Register routes in `index.ts`, update `auth.ts` exemptions, add TTL cleanup to decay job

**Phase 3: Security Hardening (steps 10-13)**
10. Generate 4 per-agent API keys, insert into `thought-tracing.db`
11. Install nginx on Hetzner (via thomas user)
12. Open firewall ports 80 + 443

**Phase 4: DNS + HTTPS (steps 13-16)**
13. Set up DNS — both subdomains → Hetzner public IP
14. Wait for DNS propagation — verify with `dig`
15. Run certbot — obtain Let's Encrypt certificates for both domains
16. Configure nginx — server blocks + rate limiting + HTTP→HTTPS redirect

**Phase 5: Integration + Testing (steps 17-19)**
17. Update BRAIN_API_URL in skills/hooks + BRAIN_PUBLIC_URL in docker-compose
18. Merge `feature/cap-hive-continuity` → `develop`, deploy to dev viz at :4200
19. End-to-end test: `curl https://hive.xpollination.earth/api/v1/recovery/agent-pdsa`

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| **Brain API** | | |
| `brain/src/services/database.ts` | MODIFY | Add agent_state + agent_identity tables, seed data |
| `brain/src/routes/recovery.ts` | CREATE | GET /api/v1/recovery/:agentId |
| `brain/src/routes/working-memory.ts` | CREATE | POST /api/v1/working-memory/:agentId |
| `brain/src/routes/onboarding.ts` | CREATE | GET / — branded HTML page |
| `brain/src/index.ts` | MODIFY | Register new routes |
| `brain/src/middleware/auth.ts` | MODIFY | Exempt GET / from auth |
| `brain/src/services/thoughtspace.ts` | MODIFY | Add getRecentByContributor() |
| `brain/src/types/index.ts` | MODIFY | Add AgentState, AgentIdentity, RecoveryResponse |
| **Assets** | | |
| `brain/public/assets/xpollination-logo-256.webp` | CREATE | Optimized logo (ImageMagick + cwebp, ~5KB) |
| `brain/public/assets/xpollination-logo-256.png` | CREATE | PNG fallback (~20KB) |
| **Infrastructure** (not in git) | | |
| `/etc/nginx/sites-available/hive.xpollination.earth` | CREATE | nginx config |
| `/etc/nginx/sites-available/mindspace.xpollination.earth` | CREATE | nginx config |
| `/etc/nginx/nginx.conf` | MODIFY | Rate limiting zone |
| DNS records | CREATE | Both subdomains |
| **Config** | | |
| `.claude/skills/xpo.claude.monitor/SKILL.md` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-first-hook.sh` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-writeback-hook.sh` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.compact-recover.sh` | MODIFY | BRAIN_API_URL env var |
| `docker-compose.yml` | MODIFY | BRAIN_PUBLIC_URL |

### Risks and Mitigations

**R1: nginx single point of failure.** Mitigation: `systemctl enable nginx` for auto-restart. nginx is stable.

**R2: Let's Encrypt renewal failure.** Certs expire every 90 days. Mitigation: certbot auto-renewal timer. Test: `sudo certbot renew --dry-run`.

**R3: DNS propagation delay.** Up to 48h globally. Mitigation: low TTL (300s). Local agents use localhost.

**R4: sudo required.** `developer` has no sudo. Mitigation: use `thomas` user via `sshpass` for nginx/certbot/firewall.

**R5: Working memory size unbounded.** Mitigation: 64KB body limit on working-memory endpoint.

**R6: Stale state misleads recovery.** Mitigation: `age_minutes` and `stale` flag in response. TTL auto-expires after 72h.

**R7: Feature branch merge conflicts.** Current `feature/wf-v18-approval-mode-enforcement` has PDSA docs only (no code changes). Low conflict risk. If conflicts exist, DEV resolves before proceeding.

**R8: Port 3200 externally exposed.** Mitigation: don't open port 3200 in firewall. All external traffic goes through nginx (443) → localhost:3200.

### Verification Plan

**Infrastructure:**
1. `dig hive.xpollination.earth` — resolves to Hetzner IP
2. `dig mindspace.xpollination.earth` — resolves to Hetzner IP
3. `curl -I https://hive.xpollination.earth` — 200, valid TLS certificate
4. `curl -I http://hive.xpollination.earth` — 301 redirect to HTTPS
5. `curl -I https://mindspace.xpollination.earth` — 200, valid TLS

**Security:**
6. `sqlite3 brain/data/thought-tracing.db "SELECT user_id FROM users WHERE user_id LIKE 'agent-%'"` — 4 rows
7. Per-agent key works: `curl -H "Authorization: Bearer <pdsa-key>" https://hive.xpollination.earth/api/v1/health`
8. Invalid key rejected: `curl -H "Authorization: Bearer invalid" ...` — 401
9. Rate limit: 61 requests in 1 minute → 429 on 61st

**Brain API:**
10. `curl GET /api/v1/recovery/agent-pdsa` — returns identity + state + context
11. `curl POST /api/v1/working-memory/agent-pdsa` with JSON — returns success
12. `curl GET /api/v1/recovery/agent-pdsa` — state updated from step 11
13. `curl GET /api/v1/recovery/agent-nonexistent` — 404
14. `curl GET /` — branded HTML with XPollination logo (no auth required)
15. TTL: set ttl_hours=0, verify cleanup deletes state
16. Graceful degradation: stop Qdrant → recovery returns identity + state with `degraded: true`

**Integration:**
17. Dev viz at `http://10.33.33.1:4200` serves develop branch with brain API changes
18. `curl https://hive.xpollination.earth/api/v1/recovery/agent-pdsa` — full recovery via public HTTPS

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
