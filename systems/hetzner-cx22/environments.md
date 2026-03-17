# XPollination Environments — Hetzner CX22

**Last verified:** 2026-03-17 (live port check)
**Server:** Hetzner CX22 — 2 vCPU, 8 GB RAM, Ubuntu 24.04, VPN IP 10.33.33.1

---

## Active Environments

| Environment | Port | Service | Working Directory | Branch | Public URL |
|-------------|------|---------|-------------------|--------|------------|
| **PROD** | 4200 | `mindspace-test.service` | `xpollination-mcp-server-test` | develop | `https://mindspace.xpollination.earth` |
| **DEV** | 4201 | *(ad-hoc process)* | — | — | VPN-only `http://10.33.33.1:4201` |

## Decommissioned

| Port | Service | Reason | Date |
|------|---------|--------|------|
| 4100 | `mindspace.service` | Replaced by 4200 as PROD | 2026-03 |
| 8080 | *(ad-hoc)* | Replaced by systemd services | 2026-03 |

## Supporting Services

| Service | Port | Binding | Purpose |
|---------|------|---------|---------|
| Mindspace API | 3100 | 10.33.33.1 | Express backend |
| Brain/Qdrant | 3200 | 127.0.0.1 | Agent memory |

## Routing

Nginx config: [`configs/nginx/mindspace.xpollination.earth`](configs/nginx/mindspace.xpollination.earth)

```
mindspace.xpollination.earth (HTTPS)
  /                        → 10.33.33.1:4200 (Viz PROD)
  /health                  → 10.33.33.1:3100 (API)
  /.well-known/agent.json  → 10.33.33.1:3100 (API)
  /api/v1/recovery         → 127.0.0.1:3200  (Brain)
```

## Decision Trail

- Architecture decision (2026-03-16): `brain://7cab861f` — PROD=4200, DEV=4201
- Port migration PDSA: `xpollination-mcp-server-test/tracks/process/viz-prod-port-migration/v0.0.1/PDSA.md`

## How to Verify

```bash
# Check what's actually running
curl -s http://localhost:4200/api/version   # PROD
curl -s http://localhost:4201/api/version   # DEV
curl -s http://localhost:4100/api/version   # should fail (decommissioned)

# Check nginx routing
cat /etc/nginx/sites-enabled/mindspace.xpollination.earth

# Check service status
systemctl status mindspace-test.service     # PROD (misleading name)
```
