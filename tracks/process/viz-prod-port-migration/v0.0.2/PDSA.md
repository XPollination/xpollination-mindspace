# PDSA: Viz Prod Port Migration — Add Version Deployment

**Task:** viz-prod-port-migration
**Version:** v0.0.2
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.1 covers infrastructure migration (systemd, firewall, port change) but does not address version deployment. After migrating to symlink-based services, the symlinks must point to the correct versions:

- PROD `viz/active` currently → v0.0.9, latest available is v0.0.10
- TEST `viz/active` currently → v0.0.4, latest available is v0.0.10

The liaison feedback requires an explicit Change I for version deployment with verification criteria.

## Design

### Change I: Version deployment after infrastructure migration

After the systemd services are created and running (Changes A-E from v0.0.1), update the symlinks to deploy the target versions:

**PROD (xpollination-mcp-server):**
```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
ln -sfn versions/v0.0.9 viz/active
sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace.service"
curl -s http://10.33.33.1:4100/api/version
# Expected: returns v0.0.9
```

Note: PROD stays on v0.0.9 (current production version). Upgrading PROD to v0.0.10 is a separate decision for Thomas.

**TEST (xpollination-mcp-server-test):**
```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test
ln -sfn versions/v0.0.10 viz/active
sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace-test.service"
curl -s http://10.33.33.1:4200/api/version
# Expected: returns v0.0.10
```

TEST updates to v0.0.10 (latest develop version) — this is the intended test environment for new features.

### Updated execution order

1. Create .env.production (Change B)
2. Create mindspace.service (Change A) — requires thomas
3. Kill ad-hoc process, enable+start service (Change C) — requires thomas
4. Update UFW firewall (Change D) — requires thomas
5. Fix TEST service symlink (Change E) — requires thomas
6. **Deploy versions via symlinks (Change I) — PROD=v0.0.9, TEST=v0.0.10**
7. Update pm.status SKILL.md (Change F)
8. Update monitor SKILL.md (Change G)
9. Verify all (Change H)

### Additional testing criteria

16. PROD `viz/active` symlink points to `versions/v0.0.9`
17. TEST `viz/active` symlink points to `versions/v0.0.10`
18. `curl -s http://10.33.33.1:4100/api/version` returns version matching v0.0.9
19. `curl -s http://10.33.33.1:4200/api/version` returns version matching v0.0.10
20. After symlink update + restart, services are still running (no crash)

### Files Changed

Same as v0.0.1 plus:
- `xpollination-mcp-server/viz/active` — symlink updated to `versions/v0.0.9`
- `xpollination-mcp-server-test/viz/active` — symlink updated to `versions/v0.0.10`
