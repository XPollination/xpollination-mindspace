# PDSA: Viz Prod Port Migration (8080 → 4100)

**Task:** viz-prod-port-migration
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The viz production server runs as an ad-hoc node process on port 8080, binding to 0.0.0.0 (all interfaces). This means:
- No automatic restart on crash or reboot
- Exposed on all network interfaces (not VPN-only)
- No systemd management (start/stop/status/logs)
- Inconsistent with the TEST setup (mindspace-test.service on 4200)

Target: systemd service on port 4100, VPN-only (10.33.33.1), with symlink-based deployment.

## Analysis

### Current state

| Aspect | PROD (8080) | TEST (4200) |
|--------|-------------|-------------|
| Process | Ad-hoc node (PID varies) | systemd mindspace-test.service |
| Bind | 0.0.0.0:8080 | 10.33.33.1:4200 |
| Deployment | viz/active symlink | Hardcoded viz/versions/v0.0.9 |
| Restart | None | on-failure, 5s |
| WorkingDir | xpollination-mcp-server | xpollination-mcp-server-test |

### server.js bind support

`server.js` already supports `VIZ_BIND` env var (line 511):
```js
const BIND_HOST = process.env.VIZ_BIND || undefined;
server.listen(PORT, BIND_HOST, () => { ... });
```

When `VIZ_BIND` is set, it binds to that address. When unset, it binds to `0.0.0.0`. No code changes needed.

### TEST service issues to fix

The test service (mindspace-test.service) has a hardcoded version path (`viz/versions/v0.0.9/server.js`) instead of using the symlink (`viz/active/server.js`). This should be fixed to use symlink-based deployment, matching the PROD pattern.

### References that need updating after migration

1. **pm.status SKILL.md** — 7 references to port 8080:
   - Line 34: port example in style guide (`8080`)
   - Line 102: `curl -s http://localhost:8080/api/settings/liaison-approval-mode`
   - Line 253: PROD infrastructure description
   - Line 254: PLANNED migration line (remove entirely)
   - Line 258: Deploy option text
   - Line 270: Verification curl
   - Lines 274-278: Migration steps section (remove entirely)

2. **monitor SKILL.md** — 1 reference:
   - Line 212: `curl -s http://localhost:8080/api/settings/liaison-approval-mode`

## Design

### Change A: Create mindspace.service

File: `/etc/systemd/system/mindspace.service`

```ini
[Unit]
Description=XPollination Mindspace Production Server (port 4100, VPN-only)
After=network.target

[Service]
Type=simple
User=developer
WorkingDirectory=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
EnvironmentFile=/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.env.production
ExecStart=/home/developer/.nvm/versions/node/v22.22.0/bin/node viz/active/server.js 4100
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=VIZ_BIND=10.33.33.1

[Install]
WantedBy=multi-user.target
```

Key differences from test service:
- Uses `viz/active/server.js` (symlink) not hardcoded version
- Port 4100 (not 4200)
- `VIZ_BIND=10.33.33.1` for VPN-only binding
- WorkingDirectory points to main repo (not -test)
- `.env.production` environment file

### Change B: Create .env.production

File: `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.env.production`

```
NODE_ENV=production
VIZ_BIND=10.33.33.1
```

This file should be gitignored (environment-specific).

### Change C: Kill ad-hoc process and start service

```bash
# 1. Find and kill ad-hoc process on 8080
sshpass -p '<password>' ssh thomas@localhost "kill $(lsof -t -i:8080) 2>/dev/null || true"

# 2. Write service file (requires thomas/root)
sshpass -p '<password>' ssh thomas@localhost "cat > /etc/systemd/system/mindspace.service" < service-file

# 3. Enable and start
sshpass -p '<password>' ssh thomas@localhost "systemctl daemon-reload"
sshpass -p '<password>' ssh thomas@localhost "systemctl enable mindspace.service"
sshpass -p '<password>' ssh thomas@localhost "systemctl start mindspace.service"
```

### Change D: Update UFW firewall

```bash
# Allow 4100 from VPN subnet
sshpass -p '<password>' ssh thomas@localhost "ufw allow from 10.33.33.0/24 to any port 4100"

# Remove 8080 rule (check first with ufw status)
sshpass -p '<password>' ssh thomas@localhost "ufw delete allow 8080"
```

### Change E: Fix TEST service to use symlink

Update mindspace-test.service ExecStart from hardcoded to symlink:

```
ExecStart=/home/developer/.nvm/versions/node/v22.22.0/bin/node viz/active/server.js 4200
```

Also add `VIZ_BIND=10.33.33.1` to ensure VPN-only binding.

```bash
sshpass -p '<password>' ssh thomas@localhost "systemctl daemon-reload"
sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace-test.service"
```

### Change F: Update pm.status SKILL.md references

Replace all 8080 references with 4100:

1. Line 34: Change `8080` to `4100` in style guide example
2. Line 102: `curl -s http://localhost:4100/api/settings/liaison-approval-mode`
3. Line 253: `PROD: mindspace.service, port 4100, main branch`
4. Line 254: Remove PLANNED migration line entirely
5. Line 258: `"Deploy to PROD (4100)"`
6. Line 270: `curl -s http://localhost:4100/api/version`
7. Lines 274-278: Remove "Port migration steps" section entirely (migration is done)

### Change G: Update monitor SKILL.md reference

Line 212: `curl -s http://localhost:4100/api/settings/liaison-approval-mode`

### Change H: Verify

```bash
# PROD on new port
curl -s http://10.33.33.1:4100/api/version

# Old port is dead
curl -s --connect-timeout 2 http://10.33.33.1:8080 || echo "Connection refused (expected)"

# Service status
sshpass -p '<password>' ssh thomas@localhost "systemctl status mindspace.service"

# TEST still works
curl -s http://10.33.33.1:4200/api/version
```

### Execution order

1. Create .env.production (Change B)
2. Create mindspace.service (Change A) — requires thomas
3. Kill ad-hoc process, enable+start service (Change C) — requires thomas
4. Update UFW firewall (Change D) — requires thomas
5. Fix TEST service symlink (Change E) — requires thomas
6. Update pm.status SKILL.md (Change F)
7. Update monitor SKILL.md (Change G)
8. Verify all (Change H)

### Files Changed

1. `/etc/systemd/system/mindspace.service` — new file (via thomas SSH)
2. `/etc/systemd/system/mindspace-test.service` — edit ExecStart + add VIZ_BIND (via thomas SSH)
3. `xpollination-mcp-server/.env.production` — new file (gitignored)
4. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — port 8080→4100
5. `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` — port 8080→4100

### Testing

1. `curl -s http://10.33.33.1:4100/api/version` returns version
2. `curl -s http://10.33.33.1:8080` returns connection refused
3. `systemctl status mindspace.service` shows active (running)
4. `systemctl status mindspace-test.service` shows active (running)
5. `curl -s http://10.33.33.1:4200/api/version` still works (TEST unbroken)
6. mindspace.service uses `viz/active/server.js` (symlink-based)
7. mindspace-test.service uses `viz/active/server.js` (fixed from hardcoded)
8. VIZ_BIND=10.33.33.1 in both services (VPN-only)
9. UFW allows 4100 from VPN subnet
10. UFW no longer allows 8080
11. pm.status SKILL.md references port 4100 (not 8080)
12. monitor SKILL.md references port 4100 (not 8080)
13. No "PLANNED: port migration" text in pm.status SKILL.md
14. No "Port migration steps" section in pm.status SKILL.md
15. .env.production exists with NODE_ENV=production and VIZ_BIND=10.33.33.1
