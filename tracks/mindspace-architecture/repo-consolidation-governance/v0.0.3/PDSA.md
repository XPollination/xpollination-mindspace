# PDSA: Repo Consolidation — Governance, Rename, Script Migration, Archive (v0.0.3)

**Task:** `repo-consolidation-governance`
**Version:** v0.0.3
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.2 (security gaps: no HTTPS, shared API key, no rate limiting)

---

## PLAN

### Rework Context

v0.0.2 proposed "Option A (port-based) for now" with HTTPS as a future enhancement. Thomas rejected:

> Bearer tokens travel in cleartext without TLS. HTTPS is MANDATORY before public exposure.
> Per-agent API keys — compromising one agent should not compromise all memory.
> Rate limiting — basic throttle to prevent abuse.
> These are NOT optional future enhancements — they are prerequisites for hive.xpollination.earth going live.

### Design Decisions (v0.0.3 changes)

**D1–D7 from v0.0.1: UNCHANGED.** Governance repo, rename sequence, script migration, archival.

**D8–D11 from v0.0.2: REVISED.** DNS, A2A, BRAIN_API_URL, docker-compose identity — all unchanged in intent, but deployment model changes from Option A (port-based) to Option B (nginx reverse proxy with HTTPS).

**D8 REVISED: DNS records + nginx reverse proxy + Let's Encrypt.**

v0.0.2 proposed port-based access. v0.0.3 mandates HTTPS:

| Subdomain | External URL | nginx → Internal |
|-----------|-------------|-----------------|
| `mindspace.xpollination.earth` | `https://mindspace.xpollination.earth` (443) | `localhost:3100` (API), `localhost:4200` (Viz via path `/viz/`) |
| `hive.xpollination.earth` | `https://hive.xpollination.earth` (443) | `localhost:3200` (Brain API) |

**nginx configuration (two server blocks):**

```nginx
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

# HTTP → HTTPS redirect for both
server {
    listen 80;
    server_name mindspace.xpollination.earth hive.xpollination.earth;
    return 301 https://$host$request_uri;
}
```

**Let's Encrypt setup (certbot):**

```bash
# Install certbot + nginx plugin (requires thomas user for sudo)
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificates (requires DNS to already point to server)
sudo certbot --nginx -d mindspace.xpollination.earth
sudo certbot --nginx -d hive.xpollination.earth

# Auto-renewal is configured by certbot (systemd timer)
```

**Critical ordering:** DNS records MUST resolve to Hetzner IP BEFORE certbot runs. Certbot validates domain ownership via HTTP-01 challenge (connects to port 80 on the server).

**D12 (NEW): Per-agent API keys.**

Current state: all agents share one `BRAIN_API_KEY` env var. The `users` table in `thought-tracing.db` has `api_key` per user, but only one user exists (`thomas`).

Target: each agent gets its own API key. The `users` table already supports this — we need to insert rows:

```sql
INSERT INTO users (user_id, display_name, api_key, qdrant_collection)
VALUES
  ('agent-liaison', 'LIAISON Agent', '<generated-uuid>', 'thought_space'),
  ('agent-pdsa', 'PDSA Agent', '<generated-uuid>', 'thought_space'),
  ('agent-dev', 'DEV Agent', '<generated-uuid>', 'thought_space'),
  ('agent-qa', 'QA Agent', '<generated-uuid>', 'thought_space');
```

All agents share the same `qdrant_collection` (`thought_space`) — they share knowledge. The API keys are different for:
1. **Revocability:** If an agent key is compromised, revoke that one key without affecting others
2. **Audit trail:** `query_log` already records `agent_id` — now the auth layer also confirms identity
3. **Future isolation:** Per-agent collections can be enabled later without schema changes

**Key provisioning:**
- Generate 4 UUIDs as API keys
- Store in `thought-tracing.db` via SQL INSERT
- Update `claude-session.sh` to set agent-specific env vars: `BRAIN_API_KEY_LIAISON`, `BRAIN_API_KEY_PDSA`, etc.
- Or simpler: each tmux pane gets its own `BRAIN_API_KEY` env var set at launch

**Backward compatibility:** Thomas's existing key (`thomas` user) continues to work. Agent keys are additional, not replacements.

**D13 (NEW): Rate limiting on Brain API.**

Basic throttle: 60 requests per minute per API key. Prevents abuse if a key is compromised or an agent enters a query loop.

**Implementation options:**

**Option A: nginx rate limiting (recommended).**

```nginx
# In http block (/etc/nginx/nginx.conf)
limit_req_zone $http_authorization zone=brain_api:10m rate=60r/m;

# In hive.xpollination.earth server block
location / {
    limit_req zone=brain_api burst=10 nodelay;
    proxy_pass http://127.0.0.1:3200;
    ...
}
```

Pros: No application code changes. nginx handles it. Returns 429 when exceeded.
Cons: Rate limit is per Authorization header value (per key) — which is exactly what we want.

**Option B: Application-level (@fastify/rate-limit).**

```typescript
import rateLimit from '@fastify/rate-limit';
await app.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.headers.authorization || request.ip
});
```

Pros: More granular control, can exempt health endpoint.
Cons: Adds a dependency, requires Brain API code change.

**Recommendation: Option A (nginx).** Rate limiting is an infrastructure concern, not an application concern. nginx is already being added for HTTPS. Keep the Brain API code simple.

**D10 REVISED: BRAIN_API_URL default changes.**

v0.0.2 proposed `BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"`. With HTTPS now mandatory:

- **Local agents** (on Hetzner): Still use `http://localhost:3200` (no TLS needed for localhost)
- **Remote agents**: Use `https://hive.xpollination.earth` (port 443, standard HTTPS)

The env var default stays `http://localhost:3200` — this is correct. Remote agents override it. The HTTPS is enforced at the nginx layer for external traffic; internal traffic stays plain HTTP.

**D11 REVISED: BRAIN_PUBLIC_URL in docker-compose.**

```yaml
brain:
  environment:
    - BRAIN_PUBLIC_URL=https://hive.xpollination.earth
```

No port in URL — standard HTTPS (443) via nginx. The Brain API health endpoint includes this:

```json
{
  "status": "ok",
  "node": "hive.xpollination.earth",
  "secure": true,
  "collections": 3
}
```

### Updated Execution Order (15 steps)

Security hardening steps are inserted BEFORE DNS goes public:

1. **Create governance repo** — no dependencies
2. **Copy scripts** from HomeAssistant → xpollination-mcp-server/scripts/, update paths
3. **Verify scripts work** from new location
4. **Generate per-agent API keys** — 4 UUIDs, insert into `thought-tracing.db`
5. **Update claude-session.sh** — set agent-specific `BRAIN_API_KEY` per pane
6. **Install nginx** on Hetzner (requires `thomas` user for sudo)
7. **Set up DNS** — `mindspace.xpollination.earth` and `hive.xpollination.earth` → Hetzner public IP
8. **Wait for DNS propagation** — verify with `dig` (may take minutes to hours)
9. **Run certbot** — obtain Let's Encrypt certificates for both domains
10. **Configure nginx** — two server blocks + HTTP→HTTPS redirect + rate limiting
11. **Update BRAIN_API_URL** in skills and hooks to use env var with localhost default
12. **Execute rename sequence** (D3-D4) — mindspace→legacy, mcp-server→mindspace
13. **Update local git remote URL** + **CLAUDE.md** references
14. **Delete old scripts from HomeAssistant** + **update symlinks**
15. **Archive repos** (best-practices, hive, mindspace-legacy) + **brain evolution thought**

**Critical dependency chain:**
- Steps 6-10 are sequential: nginx install → DNS → wait → certbot → configure
- Steps 4-5 can run in parallel with steps 1-3
- Steps 11+ can proceed once HTTPS is verified working

### Files to Create/Modify (v0.0.3 additions to v0.0.2)

| File | Action | Purpose |
|------|--------|---------|
| `/etc/nginx/sites-available/mindspace.xpollination.earth` | **CREATE** | nginx reverse proxy config |
| `/etc/nginx/sites-available/hive.xpollination.earth` | **CREATE** | nginx reverse proxy config |
| `/etc/nginx/nginx.conf` | **MODIFY** | Add rate limiting zone |
| `brain/data/thought-tracing.db` | **MODIFY** | INSERT per-agent API keys |
| `scripts/claude-session.sh` (after migration) | **MODIFY** | Per-agent BRAIN_API_KEY |
| `docker-compose.yml` | **MODIFY** | BRAIN_PUBLIC_URL=https://hive.xpollination.earth |

All v0.0.1 + v0.0.2 files still apply.

### Risks and Mitigations

**R1–R5 from v0.0.1: UNCHANGED.**
**R7–R8 from v0.0.2: UNCHANGED** (DNS propagation, firewall).

**R6 REVISED: Public exposure now secured.** v0.0.2 accepted cleartext bearer tokens. v0.0.3 requires HTTPS — bearer tokens are encrypted in transit. Per-agent keys limit blast radius. Rate limiting prevents abuse. Residual risk: TLS misconfiguration. Mitigation: certbot handles TLS config; use Mozilla SSL Configuration Generator defaults.

**R9 (NEW): nginx single point of failure.** nginx crashes → both endpoints go down. Mitigation: `systemctl enable nginx` ensures auto-restart. nginx is extremely stable. Monitor via existing health checks (if health check fails, nginx is likely down too).

**R10 (NEW): Let's Encrypt renewal failure.** Certificates expire every 90 days. Mitigation: certbot installs a systemd timer for auto-renewal. Verify with `systemctl list-timers | grep certbot`. Test renewal: `sudo certbot renew --dry-run`.

**R11 (NEW): sudo required for nginx/certbot.** `developer` user has no sudo. Mitigation: Use `thomas` user via `sshpass` for privileged operations (nginx install, certbot, firewall rules). Document which steps require elevated privileges.

### Verification Plan

1–17 from v0.0.1 + v0.0.2 still apply, with these adjustments:

15 (REVISED). `curl https://hive.xpollination.earth/api/v1/health` — HTTPS (not HTTP), no port
18. `curl -I https://hive.xpollination.earth` — returns 200, TLS certificate valid
19. `curl -I http://hive.xpollination.earth` — returns 301 redirect to HTTPS
20. `curl https://mindspace.xpollination.earth/api/settings/liaison-approval-mode` — Mindspace API via HTTPS
21. Per-agent key test: `curl -H "Authorization: Bearer <pdsa-key>" https://hive.xpollination.earth/api/v1/health` — works
22. Wrong key test: `curl -H "Authorization: Bearer invalid" https://hive.xpollination.earth/api/v1/memory` — returns 401
23. Rate limit test: send 61 requests in 1 minute → 61st returns 429
24. `sqlite3 brain/data/thought-tracing.db "SELECT user_id, display_name FROM users WHERE user_id LIKE 'agent-%'"` — 4 agent rows
25. `sudo certbot renew --dry-run` — renewal works

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
