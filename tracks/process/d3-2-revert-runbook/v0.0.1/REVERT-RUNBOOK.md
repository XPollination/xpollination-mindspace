# XPollination Revert Runbook

**Baseline snapshot:** `snapshots/production-2026-03-06T05-03-01Z.json`
**Workspace:** `/home/developer/workspaces/github/PichlerThomas`
**Last updated:** 2026-03-06

---

## Scenario 1: Test Interference with Production

When the test environment accidentally affects production services (wrong DB path, port collision, shared Qdrant collection).

### Detection
- Production viz or brain API returns unexpected data
- `xpollination.db` has test task slugs (e.g., `test-*` prefixes)
- Qdrant `thought_space` contains entries from `test_brain_*` agent IDs
- Port 8080 (production viz) serves test content

### Immediate Action
1. Stop the test system immediately:
   ```bash
   # Kill any test processes on test ports
   kill $(lsof -ti :4200) 2>/dev/null
   ```
2. Verify production is still running:
   ```bash
   curl -s http://localhost:8080/api/settings/liaison-approval-mode
   curl -s http://localhost:3200/api/v1/health
   ```

### Recovery
1. If production DB was contaminated:
   ```bash
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
   # Check for test data in production DB
   sqlite3 data/xpollination.db "SELECT slug FROM mindspace_nodes WHERE slug LIKE 'test-%'"
   # Remove test entries if found
   sqlite3 data/xpollination.db "DELETE FROM mindspace_nodes WHERE slug LIKE 'test-%'"
   ```
2. If Qdrant was contaminated, remove test entries via API:
   ```bash
   # Check for test entries in production collection
   curl -s http://localhost:6333/collections/thought_space/points/scroll -d '{"limit":10,"filter":{"must":[{"key":"agent_id","match":{"value":"test-agent"}}]}}'
   ```
3. Restart production services if they were stopped:
   ```bash
   node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions/v0.0.8/server.js 8080 &
   ```

### Verification
- Run drift check: `bash scripts/drift-check.sh`
- Confirm production snapshot ports match: compare against `snapshots/production-2026-03-06T05-03-01Z.json`
- Verify no test data in production DB

---

## Scenario 2: Service Crash

When a production service (brain API, viz server, review server) stops unexpectedly.

### Detection
- Uptime Kuma alerts (if configured)
- `curl -s http://localhost:3200/api/v1/health` fails
- `curl -s http://localhost:8080/` fails
- Agent monitor shows "Brain unavailable" errors
- `bash scripts/drift-check.sh` shows port not listening

### Immediate Action
1. Identify which service crashed:
   ```bash
   bash /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/scripts/drift-check.sh
   ```
2. Check logs for crash reason:
   ```bash
   # Systemd services
   journalctl -u review-server --since "1 hour ago" --no-pager
   # Non-systemd (brain-api, viz)
   # These run in tmux — check tmux session output
   ```

### Recovery
- **brain-api** (port 3200, non-systemd):
  ```bash
  cd /home/developer/workspaces/github/PichlerThomas/xpollination-hive
  npx tsx api/src/index.ts &
  ```
- **viz-server** (port 8080, non-systemd):
  ```bash
  node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions/v0.0.8/server.js 8080 &
  ```
- **review-server** (port 3210, systemd):
  ```bash
  # Developer user can't restart systemd services — use thomas user
  sshpass -p '$THOMAS_PASSWORD' ssh thomas@localhost "sudo systemctl restart review-server"
  ```
- **Docker containers** (qdrant, paperless, umami, uptime-kuma):
  ```bash
  sshpass -p '$THOMAS_PASSWORD' ssh thomas@localhost "docker start <container-name>"
  ```

### Verification
- Run `bash scripts/drift-check.sh` — should show 37/37
- `curl -s http://localhost:3200/api/v1/health` returns `{"status":"ok"}`
- Agent monitor (`agent-monitor.cjs dev --wait`) runs without errors

---

## Scenario 3: Bad Merge to Develop or Main

When a bad commit is merged that breaks production functionality.

### Detection
- Tests fail after merge: `npx vitest run`
- Agent CLI errors on basic operations
- Viz shows blank or error page
- Brain API returns 500 errors

### Immediate Action
1. **Never force push to main or develop.** Don't use `git push --force`.
2. Identify the bad commit:
   ```bash
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
   git log --oneline -10
   ```

### Recovery
Use `git revert` to create a new commit that undoes the bad change:
```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
# Revert a single bad commit
git revert <bad-commit-hash>
git push

# Revert a range of commits
git revert <oldest-bad>^..<newest-bad>
git push
```

If multiple repos are affected, revert in each:
```bash
for repo in xpollination-mcp-server xpollination-best-practices HomePage; do
  cd /home/developer/workspaces/github/PichlerThomas/$repo
  git revert <bad-commit-hash>
  git push
done
```

### Verification
- `npx vitest run` — all tests pass
- `bash scripts/drift-check.sh` — 37/37
- Verify affected functionality manually
- Check git log: revert commit is visible, history is clean

---

## Scenario 4: DB Corruption

When `xpollination.db` becomes corrupted (incomplete writes, disk issues, concurrent access errors).

### Detection
- CLI commands return "database disk image is malformed"
- `sqlite3 data/xpollination.db "PRAGMA integrity_check"` returns errors
- Agent transitions fail with unexpected DB errors

### Immediate Action
1. Stop all agents and services writing to the DB:
   ```bash
   # Kill viz server (reads DB)
   kill $(lsof -ti :8080) 2>/dev/null
   ```
2. Check corruption extent:
   ```bash
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
   sqlite3 data/xpollination.db "PRAGMA integrity_check"
   ```

### Recovery
1. **Try WAL recovery first** (most common fix):
   ```bash
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
   sqlite3 data/xpollination.db "PRAGMA wal_checkpoint(TRUNCATE)"
   sqlite3 data/xpollination.db "PRAGMA integrity_check"
   ```
2. **If WAL recovery fails, export and reimport:**
   ```bash
   sqlite3 data/xpollination.db ".dump" > /tmp/xpollination-dump.sql
   mv data/xpollination.db data/xpollination.db.corrupt
   sqlite3 data/xpollination.db < /tmp/xpollination-dump.sql
   sqlite3 data/xpollination.db "PRAGMA integrity_check"
   ```
3. **If dump fails, restore from backup:**
   ```bash
   # Check Synology backup (if configured by d3-1-backup-mindspace-db)
   # Or restore from git history (schema only, data lost)
   sqlite3 data/xpollination.db < src/db/schema.sql
   ```

### Verification
- `sqlite3 data/xpollination.db "PRAGMA integrity_check"` returns `ok`
- `node src/db/interface-cli.js list --status=active` works
- Restart viz server and verify dashboard loads
- Compare task count against last known state

---

## Scenario 5: Total Loss (Server Rebuild)

When the Hetzner CX22 server needs complete rebuild (hardware failure, security breach, catastrophic corruption).

### Detection
- Server unreachable via SSH and VPN
- Hetzner console shows server offline
- All services unreachable

### Immediate Action
1. Provision new CX22 instance via Hetzner console
2. Set up basic OS (Ubuntu 24.04) and user accounts
3. Configure SSH access

### Recovery
1. **Install prerequisites:**
   ```bash
   # As root/thomas user
   apt update && apt install -y git curl nginx fail2ban
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   # Create developer user
   adduser developer
   ```

2. **Restore WireGuard VPN:**
   ```bash
   # Restore wg0 config from backup
   # Reference: HomeAssistant/systems/hetzner-cx22-ubuntu/
   ```

3. **Clone all repos:**
   ```bash
   su - developer
   mkdir -p /home/developer/workspaces/github/PichlerThomas
   cd /home/developer/workspaces/github/PichlerThomas
   for repo in HomeAssistant HomePage ProfileAssistant xpollination-best-practices xpollination-hive xpollination-mcp-server xpollination-mindspace; do
     git clone git@github.com:XPollination/$repo.git
   done
   ```

4. **Install Node.js via nvm:**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
   source ~/.nvm/nvm.sh
   nvm install 22
   ```

5. **Restore Docker containers:**
   ```bash
   # Qdrant
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-hive
   docker compose up -d
   # Paperless, Umami — restore from their respective compose files
   ```

6. **Restore systemd services:**
   ```bash
   # review-server, paperless-share-webhook, parental-control
   # Reference: HomeAssistant/systems/hetzner-cx22-ubuntu/ for service files
   ```

7. **Restore nginx sites:**
   ```bash
   # Copy site configs for xpollination.earth, bestpractice, paperless, umami
   # Reference: snapshots/production-2026-03-06T05-03-01Z.json for site list
   ```

8. **Start non-systemd services:**
   ```bash
   # Brain API
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-hive
   npx tsx api/src/index.ts &
   # Viz server
   node /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/viz/versions/v0.0.8/server.js 8080 &
   ```

9. **Restore DB from backup:**
   ```bash
   # If Synology backup exists, restore xpollination.db
   # Otherwise, reinitialize from schema
   cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
   sqlite3 data/xpollination.db < src/db/schema.sql
   ```

### Verification
- Run `bash scripts/drift-check.sh` — compare against `snapshots/production-2026-03-06T05-03-01Z.json`
- All 37 checks should pass
- `curl -s http://localhost:3200/api/v1/health` returns healthy
- VPN connectivity from Synology (10.33.33.2 → 10.33.33.1)
- Agent session starts successfully: `/xpo.claude.monitor dev`

---

## General Notes

- **Never force push** to main or develop — always use `git revert` for bad merges
- **Backup DB regularly** — `xpollination.db` is the single source of truth for task state
- **Non-systemd services** (brain-api, viz-server) don't survive reboot — add to systemd or restart manually
- **Developer user has no sudo** — use thomas user via `sshpass` for privileged operations
- **Snapshot baseline:** Always compare recovery state against `snapshots/production-2026-03-06T05-03-01Z.json`
