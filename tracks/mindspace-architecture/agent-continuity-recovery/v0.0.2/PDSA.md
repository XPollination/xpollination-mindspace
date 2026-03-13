# PDSA: Agent Continuity — Full Hive Stack (v0.0.2)

**Task:** `agent-continuity-recovery`
**Version:** v0.0.2
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.1 (scope expansion — absorb all hive infrastructure from repo-consolidation-governance)

---

## PLAN

### Rework Context

v0.0.1 covered Brain API extensions (working memory, identity, recovery endpoint). Thomas directive: this task owns the FULL hive stack. Absorbing infrastructure from repo-consolidation-governance: DNS, nginx, HTTPS, per-agent API keys, rate limiting. Combined deliverable: hive.xpollination.earth fully operational with secure access and agent recovery.

### Architecture Principle

Brain is the root. Agent needs only `brain_url` + `agent_id` + HTTP. Everything else — identity, state, context — comes from brain. Works for Claude, GPT, Gemini, local LLMs, any future platform.

### Three Layers

| Layer | What | Components |
|-------|------|------------|
| **Infrastructure** | Make hive reachable and secure | DNS, nginx, HTTPS, firewall |
| **Security** | Protect access | Per-agent API keys, rate limiting |
| **Brain API** | Agent identity and recovery | Working memory, identity store, recovery endpoint, onboarding |

---

### Design Decisions

#### Layer 1: Infrastructure

**D1: DNS records for both subdomains.**

| Subdomain | Type | Target |
|-----------|------|--------|
| `mindspace.xpollination.earth` | A | Hetzner CX22 public IP |
| `hive.xpollination.earth` | A | Hetzner CX22 public IP |

Both point to the same server. nginx differentiates by subdomain.

**D2: nginx reverse proxy with HTTPS.**

Two server blocks, HTTP→HTTPS redirect, Let's Encrypt certificates:

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

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name mindspace.xpollination.earth hive.xpollination.earth;
    return 301 https://$host$request_uri;
}
```

**D3: Let's Encrypt via certbot.**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mindspace.xpollination.earth
sudo certbot --nginx -d hive.xpollination.earth
```

Requires DNS to resolve BEFORE certbot runs (HTTP-01 challenge). Auto-renewal via systemd timer.

**D4: Firewall.**

Open ports 80 (certbot challenge + redirect) and 443 (HTTPS) on Hetzner firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Internal ports (3100, 3200, 4200) stay internal — nginx proxies to them. No need to expose them publicly.

**Note:** All sudo commands require `thomas` user via `sshpass`.

#### Layer 2: Security

**D5: Per-agent API keys.**

Current: all agents share one `BRAIN_API_KEY`. Target: each agent gets its own key.

The `users` table already supports this. Insert 4 rows:

```sql
INSERT INTO users (user_id, display_name, api_key, qdrant_collection)
VALUES
  ('agent-liaison', 'LIAISON Agent', '<uuid-1>', 'thought_space'),
  ('agent-pdsa', 'PDSA Agent', '<uuid-2>', 'thought_space'),
  ('agent-dev', 'DEV Agent', '<uuid-3>', 'thought_space'),
  ('agent-qa', 'QA Agent', '<uuid-4>', 'thought_space');
```

All agents share `thought_space` collection (shared knowledge). Keys differ for:
- **Revocability:** Compromise one key → revoke it without affecting others
- **Audit trail:** Auth identifies which agent made each request
- **Future isolation:** Per-agent collections can be enabled later

**Key distribution:** `claude-session.sh` sets `BRAIN_API_KEY` per tmux pane at launch. Each pane gets its agent-specific key.

**Backward compat:** Thomas's existing key (`thomas` user) continues to work.

**D6: Rate limiting via nginx.**

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

60 requests/minute per API key. Burst of 10 allows short spikes. nginx returns 429 when exceeded. No application code change needed.

#### Layer 3: Brain API Extensions

**D7: Working memory in SQLite.**

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

`state_json` is freeform JSON. Expected fields:

```json
{
  "task_slug": "repo-consolidation-governance",
  "task_title": "...",
  "step": "Rework v0.0.4",
  "human_expectation": "Thomas wants clean D1-D7 scope",
  "pending_items": ["governance repo", "rename sequence"],
  "key_decisions": ["hive work moved to agent-continuity-recovery"],
  "context_summary": "...",
  "ad_hoc_work": null
}
```

**D8: Identity store in SQLite.**

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

Seed data for 4 agents (liaison, pdsa, dev, qa) with full responsibilities and recovery protocol.

**D9: Recovery endpoint.**

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
    "responsibilities": ["..."],
    "recovery_protocol": "..."
  },
  "working_state": {
    "task_slug": "...",
    "step": "...",
    "human_expectation": "...",
    "updated_at": "...",
    "age_minutes": 45,
    "stale": false
  },
  "key_context": [
    {
      "thought_id": "...",
      "content": "Full thought content",
      "category": "transition_marker",
      "topic": "...",
      "score": 0.92
    }
  ],
  "recent_transitions": ["..."],
  "degraded": false,
  "recovered_at": "..."
}
```

Implementation:
1. Look up `agent_identity` → 404 if not found
2. Look up `agent_state` → null if fresh agent
3. Check TTL → mark `stale: true` if expired but still return data
4. Query Qdrant for top 5 thoughts by this contributor (transition_marker, state_snapshot, decision_record categories, sorted by recency)
5. Fetch full content for top 3 (not previews)
6. Assemble response

Graceful degradation: if Qdrant is down, return identity + state with `degraded: true` and empty `key_context`.

**D10: Working memory push endpoint.**

```
POST /api/v1/working-memory/:agentId
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "session_id": "uuid",
  "state": { ... }
}
```

Max body size: 64KB. Replaces previous state atomically (`INSERT OR REPLACE`).

**D11: Onboarding page at root.**

```
GET /
```

Returns static HTML (no auth required):

```html
<h1>XPollination Hive</h1>
<p>Agent identity, memory, and A2A protocol endpoint.</p>
<h2>For Agents</h2>
<ol>
  <li>Authenticate: Authorization: Bearer YOUR_API_KEY</li>
  <li>Recover: GET /api/v1/recovery/{your_agent_id}</li>
  <li>Push state: POST /api/v1/working-memory/{your_agent_id}</li>
  <li>Query knowledge: POST /api/v1/memory</li>
</ol>
```

**D12: TTL cleanup job.**

Run hourly alongside existing pheromone decay:

```sql
DELETE FROM agent_state
WHERE datetime(updated_at, '+' || ttl_hours || ' hours') < datetime('now');
```

**D13: BRAIN_API_URL env var in skills and hooks.**

```bash
BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"
```

Update in:
- `.claude/skills/xpo.claude.monitor/SKILL.md`
- `scripts/hooks/xpo.claude.brain-first-hook.sh`
- `scripts/hooks/xpo.claude.brain-writeback-hook.sh`
- `scripts/hooks/xpo.claude.compact-recover.sh`

Local agents use localhost default. Remote agents override with `https://hive.xpollination.earth`.

**D14: BRAIN_PUBLIC_URL in docker-compose.**

```yaml
brain:
  environment:
    - BRAIN_PUBLIC_URL=https://hive.xpollination.earth
```

Health endpoint includes this in response.

---

### Execution Order (16 steps)

**Phase 1: Security foundation (steps 1-5)**
1. Generate 4 per-agent API keys (UUIDs)
2. Insert keys into `thought-tracing.db` users table
3. Update `claude-session.sh` to set per-agent `BRAIN_API_KEY`
4. Install nginx on Hetzner (via thomas user)
5. Open firewall ports 80 + 443

**Phase 2: DNS + HTTPS (steps 6-9)**
6. Set up DNS — both subdomains → Hetzner public IP
7. Wait for DNS propagation — verify with `dig`
8. Run certbot — obtain certificates for both domains
9. Configure nginx — server blocks + rate limiting + HTTP→HTTPS redirect

**Phase 3: Brain API extensions (steps 10-14)**
10. Extend database schema — `agent_state` + `agent_identity` tables with seed data
11. Create recovery route — `GET /api/v1/recovery/:agentId`
12. Create working-memory route — `POST /api/v1/working-memory/:agentId`
13. Create onboarding route — `GET /`
14. Register routes + update auth exemptions + add TTL cleanup

**Phase 4: Integration (steps 15-16)**
15. Update BRAIN_API_URL in skills/hooks + BRAIN_PUBLIC_URL in docker-compose
16. End-to-end test: `curl https://hive.xpollination.earth/api/v1/recovery/agent-pdsa`

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| **Infrastructure** | | |
| `/etc/nginx/sites-available/hive.xpollination.earth` | CREATE | nginx reverse proxy |
| `/etc/nginx/sites-available/mindspace.xpollination.earth` | CREATE | nginx reverse proxy |
| `/etc/nginx/nginx.conf` | MODIFY | Rate limiting zone |
| DNS records | CREATE | Both subdomains |
| **Brain API** | | |
| `brain/src/services/database.ts` | MODIFY | Add agent_state + agent_identity tables |
| `brain/src/routes/recovery.ts` | CREATE | Recovery endpoint |
| `brain/src/routes/working-memory.ts` | CREATE | Working memory push |
| `brain/src/routes/onboarding.ts` | CREATE | Static HTML page |
| `brain/src/index.ts` | MODIFY | Register new routes |
| `brain/src/middleware/auth.ts` | MODIFY | Exempt GET / from auth |
| `brain/src/services/thoughtspace.ts` | MODIFY | Add getRecentByContributor() |
| `brain/src/types/index.ts` | MODIFY | Add interfaces |
| **Config** | | |
| `.claude/skills/xpo.claude.monitor/SKILL.md` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-first-hook.sh` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-writeback-hook.sh` | MODIFY | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.compact-recover.sh` | MODIFY | BRAIN_API_URL env var |
| `docker-compose.yml` | MODIFY | BRAIN_PUBLIC_URL |

### Risks and Mitigations

**R1: nginx single point of failure.** nginx crashes → endpoints down. Mitigation: `systemctl enable nginx` for auto-restart. nginx is extremely stable.

**R2: Let's Encrypt renewal failure.** Certificates expire every 90 days. Mitigation: certbot auto-renewal via systemd timer. Test: `sudo certbot renew --dry-run`.

**R3: DNS propagation delay.** Up to 48h globally. Mitigation: low TTL (300s). Local agents use localhost regardless.

**R4: Sudo required.** `developer` user has no sudo. Mitigation: Use `thomas` user via `sshpass` for nginx/certbot/firewall. Document which steps need elevation.

**R5: SQLite concurrent writes.** Single Fastify process handles all writes. WAL mode for concurrent reads. No risk.

**R6: Working memory size unbounded.** Mitigation: 64KB body limit on working-memory endpoint.

**R7: Agent identity theft.** Any valid API key can read any agent's recovery. Mitigation: All agents belong to same human (Thomas). Per-agent keys add revocability. Future: ownership check.

**R8: Stale state misleads recovery.** Mitigation: `age_minutes` and `stale` flag in response. TTL auto-expires after 72h.

**R9: Port 3200 publicly exposed.** Mitigation: Don't expose port 3200 in firewall. All external traffic goes through nginx (443) → localhost:3200. Internal agents use localhost directly.

### Verification Plan

**Infrastructure:**
1. `dig hive.xpollination.earth` — resolves to Hetzner IP
2. `dig mindspace.xpollination.earth` — resolves to Hetzner IP
3. `curl -I https://hive.xpollination.earth` — 200, valid TLS
4. `curl -I http://hive.xpollination.earth` — 301 redirect to HTTPS
5. `curl -I https://mindspace.xpollination.earth` — 200, valid TLS

**Security:**
6. `sqlite3 brain/data/thought-tracing.db "SELECT user_id FROM users WHERE user_id LIKE 'agent-%'"` — 4 rows
7. Per-agent key works: `curl -H "Authorization: Bearer <pdsa-key>" https://hive.xpollination.earth/api/v1/health`
8. Invalid key rejected: `curl -H "Authorization: Bearer invalid" ...` — 401
9. Rate limit: 61 requests in 1 minute → 429

**Brain API:**
10. `curl GET /api/v1/recovery/agent-pdsa` — returns identity + state + context
11. `curl POST /api/v1/working-memory/agent-pdsa` with JSON — returns success
12. `curl GET /api/v1/recovery/agent-pdsa` — returns updated state
13. `curl GET /api/v1/recovery/agent-nonexistent` — 404
14. `curl GET /` — HTML onboarding page (no auth)
15. TTL: set ttl_hours=0, verify cleanup deletes state
16. Graceful degradation: stop Qdrant → recovery returns identity + state with `degraded: true`

**End-to-end:**
17. `curl https://hive.xpollination.earth/api/v1/recovery/agent-pdsa` — full recovery via public URL with HTTPS

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
