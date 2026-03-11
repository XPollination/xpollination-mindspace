# PDSA: Serve mindspace-test (4200) from develop worktree

**Task:** ms-a18-1-develop-worktree-viz
**Status:** Design
**Version:** v0.0.1

## Plan

Update mindspace-test.service to serve develop branch features on port 4200, while PROD (4100) stays on main's versioned release.

### Dependencies

- None (infrastructure task)

### Investigation

**Current state:**
- Worktree already exists: `xpollination-mcp-server-test` at develop branch
- `mindspace-test.service` already points to the worktree
- Problem: Both PROD and TEST use `viz/active/server.js` → `versions/v0.0.11/server.js`
- The develop branch has unversioned `viz/server.js` with new features (auto-approval mode, etc.)
- TEST should use `viz/server.js` directly to preview develop features

**Design decisions:**
- Change ExecStart in mindspace-test.service from `viz/active/server.js` to `viz/server.js`
- This makes TEST serve the develop branch's latest `viz/server.js`
- PROD stays on `viz/active/server.js` → versioned release (unchanged)
- `git pull` on develop worktree immediately updates TEST features
- Document worktree path in CLAUDE.md

## Do

### Steps (Infrastructure — no code files)

#### 1. Update mindspace-test.service

Change ExecStart line:
```
# FROM:
ExecStart=/home/developer/.nvm/versions/node/v22.22.0/bin/node viz/active/server.js 4200
# TO:
ExecStart=/home/developer/.nvm/versions/node/v22.22.0/bin/node viz/server.js 4200
```

This requires sudo (thomas user):
```bash
sshpass -p '<password>' ssh thomas@localhost "sudo sed -i 's|viz/active/server.js 4200|viz/server.js 4200|' /etc/systemd/system/mindspace-test.service"
sshpass -p '<password>' ssh thomas@localhost "sudo systemctl daemon-reload"
sshpass -p '<password>' ssh thomas@localhost "sudo systemctl restart mindspace-test"
```

#### 2. Verify

```bash
curl -s http://10.33.33.1:4200/api/settings/liaison-approval-mode
# Should return auto-approval as valid mode (develop feature)

curl -s http://10.33.33.1:4100/api/settings/liaison-approval-mode
# Should still work (PROD unchanged)
```

#### 3. Update CLAUDE.md

Add to the Environment or Architecture section:
```markdown
## Viz Environments

| Port | Service | Branch | Server |
|------|---------|--------|--------|
| 4100 | mindspace (PROD) | main | viz/active/server.js (versioned) |
| 4200 | mindspace-test (TEST) | develop | viz/server.js (unversioned, latest) |

**Worktree:** `xpollination-mcp-server-test` = develop branch worktree of xpollination-mcp-server
```

## Study

### Test Cases (4 total)

1. mindspace-test.service ExecStart uses viz/server.js (not viz/active/server.js)
2. Port 4200 serves develop features (auto-approval mode accepted by PUT)
3. Port 4100 still serves PROD (unchanged)
4. `git pull` in develop worktree updates 4200 after service restart

## Act

### Deployment

- 1 service file change (mindspace-test.service — requires sudo)
- 1 documentation update (CLAUDE.md)
- No code changes, no migrations
- Verify both ports respond correctly after restart
