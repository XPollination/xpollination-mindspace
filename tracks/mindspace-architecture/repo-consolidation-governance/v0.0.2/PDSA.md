# PDSA: Repo Consolidation — Governance, Rename, Script Migration, Archive (v0.0.2)

**Task:** `repo-consolidation-governance`
**Version:** v0.0.2
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.1 (missing hive.xpollination.earth context and A2A server)

---

## PLAN

### Rework Context

v0.0.1 covered D1-D7 execution but missed new context from Thomas:

> - `hive.xpollination.earth` will be the agent identity and recovery URL — agents connect to discover who they are and recover their memory
> - The A2A (Agent-to-Agent) server needs to come online as part of this work
> - `mindspace.xpollination.earth` is for the PM/capability/mission site
> - The rename sequence must consider the hive endpoint

### Domain Architecture (NEW)

Two public-facing endpoints:

| Domain | Service | Port | Purpose |
|--------|---------|------|---------|
| `mindspace.xpollination.earth` | Mindspace API + Viz | 3100/4200 | PM system — missions, capabilities, tasks, kanban |
| `hive.xpollination.earth` | Brain API | 3200 | Agent identity, memory recovery, knowledge contribution |

**What is the Hive?** When an agent starts on a new machine or after context loss, it receives `hive.xpollination.earth` as its recovery endpoint. The agent connects, identifies itself (agent_id + API key), and the Brain returns:
- Role definition and responsibilities
- Current task state
- Recent decisions and learnings
- Operational knowledge

This is the Brain API (now at `brain/` in the repo) served via a public domain. The `xpollination-hive` GitHub repo name was prescient — "hive" IS the brain/knowledge endpoint. But the repo itself was a stale copy. The actual service lives in `xpollination-mcp-server/brain/`.

### Design Decisions (v0.0.2 additions)

**D1–D7 from v0.0.1: UNCHANGED.** Governance repo, rename sequence, script migration, archival.

**D8 (NEW): DNS records for xpollination.earth subdomains.**

| Subdomain | Type | Target | Proxy |
|-----------|------|--------|-------|
| `mindspace.xpollination.earth` | A / CNAME | Hetzner CX22 IP or VPN IP | Optional (Cloudflare/nginx) |
| `hive.xpollination.earth` | A / CNAME | Same Hetzner CX22 | Optional |

Both services run on the same server. Differentiation is by port (3100/4200 vs 3200) or by reverse proxy (nginx routes by subdomain).

**Two deployment options:**

**Option A: Port-based (simplest).**
- `mindspace.xpollination.earth:3100` → Mindspace API
- `mindspace.xpollination.earth:4200` → Mindspace Viz
- `hive.xpollination.earth:3200` → Brain API

Both domains point to the same IP. Each service listens on its own port. No reverse proxy needed. Agents use `hive.xpollination.earth:3200` in their configuration.

**Option B: Reverse proxy (standard HTTPS).**
- `mindspace.xpollination.earth` → nginx → localhost:3100 (API) and localhost:4200 (Viz via path)
- `hive.xpollination.earth` → nginx → localhost:3200 (Brain)

Adds HTTPS, standard port 443, no port in URL. Requires nginx + Let's Encrypt.

**Recommendation: Option A for now.** Matches current setup (services listen on specific ports). Thomas can add nginx/HTTPS later as a separate task. The immediate goal is making the endpoints reachable.

**D9 (NEW): A2A server — Brain API IS the A2A endpoint.**

The Brain API already supports the Agent-to-Agent protocol:
- `POST /api/v1/memory` — agents query and contribute knowledge
- Bearer token auth — each agent has an API key
- Agent identification — `agent_id` and `agent_name` in requests
- Multi-user support — per-agent Qdrant collections

No new server is needed. The Brain API at `hive.xpollination.earth:3200` IS the A2A server. What needs to happen:
1. DNS record for `hive.xpollination.earth` → Hetzner IP
2. Brain API listens on `0.0.0.0:3200` (already does)
3. Firewall allows port 3200 from external (if agents on other machines need access)

If agents only run on the Hetzner server, the existing `localhost:3200` works. External access requires firewall/security considerations — that's a separate task.

**D10 (NEW): Agent recovery URL in skills and hooks.**

The `xpo.claude.monitor` skill and hook scripts currently hardcode `http://localhost:3200`. For remote agent support, these should use an environment variable:

```bash
BRAIN_API_URL="${BRAIN_API_URL:-http://localhost:3200}"
```

This allows local agents to use localhost (default) while remote agents can set `BRAIN_API_URL=https://hive.xpollination.earth:3200`.

Update in:
- `.claude/skills/xpo.claude.monitor/SKILL.md` — all `curl` commands reference brain URL
- `scripts/hooks/xpo.claude.brain-first-hook.sh`
- `scripts/hooks/xpo.claude.brain-writeback-hook.sh`
- `scripts/hooks/xpo.claude.compact-recover.sh`

**D11 (NEW): Hive identity in docker-compose.**

The brain service in docker-compose should declare its public identity:

```yaml
brain:
  environment:
    - BRAIN_PUBLIC_URL=https://hive.xpollination.earth:3200
```

This is informational for now — the Brain API can include it in health check responses so agents know where they're connected:

```json
{
  "status": "healthy",
  "node": "hive.xpollination.earth",
  "collections": 3
}
```

### Updated Execution Order (12 steps)

1. **Create governance repo** — no dependencies
2. **Copy scripts** from HomeAssistant → xpollination-mcp-server/scripts/, update paths
3. **Verify scripts work** from new location
4. **Set up DNS** — `mindspace.xpollination.earth` and `hive.xpollination.earth` → Hetzner IP
5. **Update BRAIN_API_URL** in skills and hooks to use env var with localhost default
6. **Execute rename sequence** (D3-D4 from v0.0.1) — mindspace→legacy, mcp-server→mindspace
7. **Update local git remote URL** — `origin` → `xpollination-mindspace.git`
8. **Update CLAUDE.md** — repo name references
9. **Delete old scripts from HomeAssistant** — after verified working
10. **Update symlinks** — point to new script locations
11. **Archive repos** — best-practices, hive, mindspace-legacy
12. **Brain evolution thought** — document consolidation + hive endpoint

### Files to Create/Modify (additions from v0.0.1)

| File | Action | Purpose |
|------|--------|---------|
| DNS records | **CREATE** | mindspace + hive subdomains |
| `.claude/skills/xpo.claude.monitor/SKILL.md` | **MODIFY** | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-first-hook.sh` | **MODIFY** | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.brain-writeback-hook.sh` | **MODIFY** | BRAIN_API_URL env var |
| `scripts/hooks/xpo.claude.compact-recover.sh` | **MODIFY** | BRAIN_API_URL env var |
| `docker-compose.yml` | **MODIFY** | Add BRAIN_PUBLIC_URL to brain service |

All v0.0.1 files still apply (governance repo, ADR, inventory, scripts, CLAUDE.md).

### Risks and Mitigations

**R1–R5 from v0.0.1: UNCHANGED.**

**R6 (NEW): Exposing Brain API publicly.** `hive.xpollination.earth:3200` makes the Brain API reachable from the internet. Mitigation: Bearer token auth already enforced. Rate limiting is a future enhancement. For now, API keys provide sufficient access control.

**R7 (NEW): DNS propagation delay.** DNS changes take up to 48h to propagate globally. Mitigation: TTL can be set low (300s). Agents on the same server use localhost regardless. DNS is for remote/future agents.

**R8 (NEW): Port 3200 firewall.** Hetzner firewall may block 3200. Mitigation: Check `ufw status` and add rule if needed. Only needed for remote agent access.

### Verification Plan

1–12 from v0.0.1 still apply.

13. `dig mindspace.xpollination.earth` — DNS resolves to Hetzner IP
14. `dig hive.xpollination.earth` — DNS resolves to Hetzner IP
15. `curl http://hive.xpollination.earth:3200/api/v1/health` — Brain API responds (if firewall open)
16. `grep BRAIN_API_URL .claude/skills/xpo.claude.monitor/SKILL.md` — env var present
17. `grep BRAIN_API_URL scripts/hooks/xpo.claude.brain-first-hook.sh` — env var present

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
