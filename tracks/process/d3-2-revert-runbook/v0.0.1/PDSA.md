# PDSA: Revert Runbook (5 Scenarios)

**Task:** d3-2-revert-runbook
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

No documented revert procedures exist. When something breaks in production, agents and Thomas have no reference for how to recover. This runbook covers 5 failure scenarios with detection, immediate action, recovery, and verification steps.

## Design

### Deliverable

A single file: `tracks/process/d3-2-revert-runbook/v0.0.1/REVERT-RUNBOOK.md`

This is a knowledge artifact (documentation), not code. DEV creates the file from this design. The runbook references the production snapshot at `snapshots/production-2026-03-06T05-03-01Z.json` as the known-good baseline.

### Infrastructure Context (from snapshot)

- **Server:** Hetzner CX22, Ubuntu 24.04, 2 vCPU, 8GB RAM
- **Services:** 15 listening ports, 7 Docker containers, 5 Qdrant collections
- **Key services:** brain-api (port 3200), viz-server, xpollination-mcp-server, nginx, Qdrant
- **Databases:** SQLite (xpollination.db per project), Qdrant (vector DB)
- **Git repos:** 7 repos under /home/developer/workspaces/github/PichlerThomas/
- **No sudo** for developer user; thomas user for privileged ops

### Runbook Structure (5 Scenarios)

#### Scenario 1: Test Interference with Production
**Detection:** Tests modify production DB or crash a running service.
**Immediate:** Stop the test process. Check service health.
**Recovery:**
- Restore DB from last known good: `cp data/xpollination.db.bak data/xpollination.db`
- If no backup exists: check git for last committed DB state
- Restart affected service
**Verification:** Service responds, DB queries return expected data.
**Prevention:** Tests must use separate DB path (env var override).

#### Scenario 2: Service Crash
**Detection:** Port not responding, systemd shows failed, or process not in `ps`.
**Immediate:** Check which service crashed: `ss -tlnp | grep PORT`
**Recovery by service type:**
- **Systemd-managed** (brain-api, nginx): `sudo systemctl restart SERVICE`
- **Non-systemd** (viz-server): `node viz/versions/active/server.js &`
- **Docker containers:** `docker restart CONTAINER_NAME`
**Verification:** Port responds, health endpoint returns 200.

#### Scenario 3: Bad Merge to Main
**Detection:** Tests fail after push, or agents report errors.
**Immediate:** Identify the bad commit: `git log --oneline -5`
**Recovery:**
- `git revert BAD_COMMIT_HASH` (creates new commit, preserves history)
- Push the revert: `git push`
- If multiple commits: revert in reverse order
- **NEVER** force-push main
**Verification:** Tests pass, services restart cleanly.

#### Scenario 4: DB Corruption
**Detection:** SQLite errors ("database disk image is malformed"), unexpected query results.
**Immediate:** Stop all agents writing to DB.
**Recovery:**
- Check integrity: `sqlite3 data/xpollination.db "PRAGMA integrity_check"`
- If recoverable: `sqlite3 data/xpollination.db ".recover" | sqlite3 data/xpollination-recovered.db`
- If not recoverable: restore from backup or recreate from snapshot
- For Qdrant: restart Qdrant container, check collections exist
**Verification:** `PRAGMA integrity_check` returns "ok", queries return data.

#### Scenario 5: Total Loss (Server Rebuild)
**Detection:** Server unreachable, Hetzner shows server down.
**Immediate:** Check Hetzner console for server status.
**Recovery:**
- Reinstall OS from Hetzner console
- Clone all 7 git repos
- Install dependencies: nvm, node, npm packages
- Restore DBs from backups or recreate schemas
- Restore Qdrant data from snapshots
- Restore nginx configs, systemd services, Docker containers
- Reference production snapshot for port assignments and service configs
- Restore VPN (WireGuard) config
**Verification:** All 15 ports listening, all services responding, VPN connected.

### Files Changed

1. `tracks/process/d3-2-revert-runbook/v0.0.1/REVERT-RUNBOOK.md` — the full runbook

### Testing

This is a documentation task. QA verifies:
1. All 5 scenarios present with detection/immediate/recovery/verification sections
2. Commands are accurate for the production environment (correct paths, no sudo where developer user)
3. References to snapshot are correct
4. No sensitive credentials in the runbook
