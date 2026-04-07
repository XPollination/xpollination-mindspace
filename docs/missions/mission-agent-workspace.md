# Agent Workspace — Persistent, Writable, Portable

**Ref:** MISSION-AGENT-WORKSPACE
**Version:** v1.0.0
**Date:** 2026-04-07
**Authors:** Thomas Pichler + LIAISON Agent
**Status:** Draft — priority for today

<!-- @section: problem | v:1 -->
## Problem Statement

### What Thomas reported
1. Agents spawned via viz +Team work inside the Docker container at `/app`
2. `/app` is COPY'd from the image — ephemeral, lost on restart
3. `/workspace` is mounted from host but read-only
4. Agents created files (board-config.yaml, WORKFLOW.md) that exist only in container memory
5. Agents have no git — can't commit or push their work
6. tmux mousewheel sends key up/down instead of scrolling in the current beta server configuration

### What this blocks
- MISSION-TASK-VIEW-UX: agents did work but it's trapped in the container
- Multi-hub vision: Robin's agents need the same pattern — container spawns, workspace mounts, work persists

### The opportunity
The container-based agent runtime IS the right architecture for multi-hub. What's missing is the workspace mount. Fix it once here → Robin's hub is just a different mount path (a twin configuration).

---

<!-- @section: current-state | v:1 -->
## Current State (verified 2026-04-07)

### Container layout
```
mindspace-test container:
  /app/                    ← COPY'd from image, writable but EPHEMERAL
  /app/data/               ← Volume mount (rw) — database persists
  /app/viz/                ← COPY'd — served by viz server
  /app/api/                ← COPY'd — API code
  /app/scripts/            ← COPY'd — agent scripts
  /workspace/              ← Bind mount from host (RO) — all Thomas repos
  /workspace/xpollination-mindspace/  ← The actual project — READ ONLY
```

### Agent spawn chain
```
viz +Team button
  → POST /api/team/:project/agent { role }
    → team.ts spawnAgent()
      → createSession(sessionName, command)   // tmux inside container
        → claude --allowedTools '*' --append-system-prompt "..."
      → createSession(bridgeSession, bridgeCmd)  // SSE bridge
      → createSession(unblockSession, unblockCmd) // auto-confirm
```

### What agents have
- Claude Code v2.1.89 at `/usr/local/bin/claude`
- Node.js at `/usr/local/bin/node`
- tmux at `/usr/bin/tmux`
- A2A delivery script at `/app/scripts/a2a-deliver.js`
- Brain access via `BRAIN_API_URL=http://host.docker.internal:3200`
- Sandbox MCP when configured

### What agents DON'T have
- **git** — `command not found`
- **Writable workspace** — `/workspace` is read-only
- **Persistent file storage** — `/app` writes are lost on restart
- **CLAUDE.md** — no project-level instructions loaded
- **tmux mouse scrolling** — mousewheel sends key up/down instead of scroll

### How team.ts spawns (current — wrong)
```typescript
// team.ts line 27-28
const rolePrompt = `You are the ${role.toUpperCase()} agent...`;
const command = `claude --allowedTools '*' --append-system-prompt "${rolePrompt}"`;
```

No working directory set. No workspace mount. Agent starts at `/app` (container root). The `start-agent.sh` script exists but team.ts doesn't use it — it calls claude directly.

---

<!-- @section: design | v:1 -->
## Design: Writable Workspace Mount

### Change 1: Mount workspace read-write per project

In `docker-compose.test.yml`, change the workspace mount:

```yaml
volumes:
  - /mnt/HC_Volume_105173237/mindspace/data-test/mindspace:/app/data
  - /home/developer/workspaces/github/PichlerThomas:/workspace:rw   # ← was :ro
```

Or more precisely, mount only the project workspace:
```yaml
  - /home/developer/workspaces/github/PichlerThomas/xpollination-mindspace:/workspace/xpollination-mindspace:rw
```

**For Robin's hub:** same pattern, different host path:
```yaml
  - /home/robin/workspaces/xpollination-mindspace:/workspace/xpollination-mindspace:rw
```

The twin configuration defines the mount path. Container is identical.

### Change 2: Agent starts in project workspace

In `team.ts`, set the working directory when spawning:

```typescript
const workspacePath = `/workspace/${projectSlug}`;
const command = `cd ${workspacePath} && claude --allowedTools '*' --append-system-prompt "${rolePrompt}"`;
```

Or better — use `start-agent.sh` which already handles A2A connection:

```typescript
const command = `cd ${workspacePath} && /app/scripts/start-agent.sh ${role} ${userId} http://localhost:${apiPort}`;
```

### Change 3: Install git in container

Add to Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
```

Configure git identity per agent (in start-agent.sh or team.ts):
```bash
git config --global user.name "${ROLE}-agent"
git config --global user.email "${ROLE}@xpollination.earth"
```

### Change 4: tmux mouse scrolling

Add tmux config for mouse support:

```bash
# In Dockerfile or startup.sh
echo "set -g mouse on" >> /etc/tmux.conf
```

This enables mousewheel scrolling in tmux panes instead of sending key up/down.

### Change 5: Task delivery hard gate on pending

The task announcer (`api/lib/task-announcer.ts:56`) queries:
```sql
WHERE t.status IN ('ready', 'approval', 'review', 'rework', 'approved')
```

`pending` is already excluded. But agents received work for pending tasks anyway — through the SSE bridge delivering stale events. The bridge should verify task status before delivering.

---

<!-- @section: portable | v:1 -->
## Portability: Thomas's Hub → Robin's Hub

The design must work for any hub. The differences between hubs:

| Setting | Thomas's Hub | Robin's Hub |
|---------|-------------|-------------|
| Host workspace path | `/home/developer/workspaces/github/PichlerThomas/xpollination-mindspace` | `/home/robin/workspaces/xpollination-mindspace` |
| Container mount | `/workspace/xpollination-mindspace:rw` | `/workspace/xpollination-mindspace:rw` |
| Git remote | `github.com:XPollination/xpollination-mindspace.git` | Same (or fork) |
| Brain URL | `http://host.docker.internal:3200` | `https://hive.xpollination.earth` (remote) |
| Agent identity | `liaison-agent-thomas-uuid` | `liaison-agent-robin-uuid` |

**What stays the same across hubs:**
- Container image (same Dockerfile)
- `/workspace/xpollination-mindspace` as working directory inside container
- A2A protocol and message types
- Agent spawn chain (team.ts → tmux → claude)
- Scripts at `/app/scripts/`

**What changes (twin configuration):**
- Volume mount source path (host-specific)
- Brain URL (local vs remote)
- Git credentials
- User identity

This is a twin configuration — the agent runtime is identical, the workspace binding is per-hub.

---

<!-- @section: tests | v:1 -->
## Test Cases

### TC-WS-1: Agent writes to workspace
```
GIVEN: Agent spawned via +Team
WHEN: Agent creates a file in the project workspace
THEN: File persists at /workspace/xpollination-mindspace/...
AND: File is visible on the host filesystem
AND: File survives container restart
```

### TC-WS-2: Agent commits and pushes
```
GIVEN: Agent in project workspace with git available
WHEN: Agent edits a file, stages, commits, and pushes
THEN: Commit appears on remote (GitHub)
AND: git log shows agent identity as author
```

### TC-WS-3: Agent starts in correct directory
```
GIVEN: Agent spawned for project xpollination-mindspace
WHEN: Agent runs pwd
THEN: Output is /workspace/xpollination-mindspace
AND: Agent can read CLAUDE.md, viz/, api/, docs/
```

### TC-WS-4: tmux mouse scrolling
```
GIVEN: Agent tmux session open in browser terminal
WHEN: User scrolls mousewheel
THEN: tmux scrolls through output history
AND: Does NOT send key up/down to the active process
```

### TC-WS-5: Container restart preserves workspace
```
GIVEN: Agent wrote files to /workspace/xpollination-mindspace/
WHEN: Container is restarted (docker compose restart)
THEN: Agent files still exist at /workspace/xpollination-mindspace/
AND: New agent can see previous agent's work
```

### TC-WS-6: Pending tasks not delivered
```
GIVEN: Tasks at status=pending in database
WHEN: Agent is connected via SSE bridge
THEN: Agent does NOT receive work for pending tasks
AND: Only tasks at ready or later are delivered
```

---

<!-- @section: decisions | v:1 -->
## Decisions

| # | Decision | Rationale | Status |
|---|----------|-----------|--------|
| D1 | Mount workspace read-write | Agents need to write files that persist. RO mount forces work into ephemeral /app. | Proposed |
| D2 | Agent starts in `/workspace/{project_slug}` | Agent needs project context — CLAUDE.md, file structure, git history | Proposed |
| D3 | Install git in container image | Agents must commit and push. Without git, work is trapped. | Proposed |
| D4 | `set -g mouse on` in tmux.conf | Mousewheel should scroll, not send key events | Proposed |
| D5 | Verify task status before SSE delivery | Pending tasks must not reach agents. Hard gate. | Proposed |
| D6 | Twin configuration for workspace mount | Same container image, different mount path per hub. Robin's hub = different volume source. | Proposed |
