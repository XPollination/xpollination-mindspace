# PDSA: Parameterized Monitor Skill (DRY Pattern)

**Date:** 2026-02-04
**Type:** Design + Implementation
**Status:** IMPLEMENTING

## PLAN

### Problem
1. Monitor script hardcodes roles (pdsa, qa)
2. Dev agent needs same monitoring capability
3. Running full queries in Claude wastes tokens
4. Multiple scripts = violation of DRY

### Solution
1. **Single parameterized script** - accepts role(s) as arguments
2. **Lightweight file check** - script writes to role-specific files
3. **Minimal token monitoring** - Claude just checks file size (bytes)

### Design

**Script:** `viz/agent-monitor.cjs`

```bash
# PDSA agent
node agent-monitor.cjs pdsa qa

# Dev agent
node agent-monitor.cjs dev

# All roles
node agent-monitor.cjs pdsa qa dev
```

**Output files:**
- `/tmp/agent-work-pdsa.json`
- `/tmp/agent-work-qa.json`
- `/tmp/agent-work-dev.json`

**Claude monitoring (minimal tokens):**
```bash
stat -c%s /tmp/agent-work-pdsa.json 2>/dev/null || echo 0
```
- Returns file size in bytes
- 0 = no work, >0 = work found
- Single stat call = minimal tokens

## DO

Implementing now.

## STUDY

(After implementation)

## ACT

(After review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-parameterized-monitor-skill.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-parameterized-monitor-skill.pdsa.md
