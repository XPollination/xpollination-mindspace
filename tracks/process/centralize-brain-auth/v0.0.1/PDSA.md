# PDSA: Centralize brain API auth

**Task:** centralize-brain-auth
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

`Authorization: Bearer $BRAIN_API_KEY` is scattered across 5+ skill files (19+ occurrences):
- `xpo.claude.mindspace.brain/SKILL.md` (4 occurrences)
- `xpo.claude.clear/SKILL.md` (1 occurrence)
- `xpo.claude.monitor/SKILL.md` (3 occurrences + AUTH_HDR variable)
- `xpo.claude.mindspace.reflect/SKILL.md` (8 occurrences)
- `xpo.claude.mindspace.garden/SKILL.md` (2 occurrences)

This violates separation of concerns. If the auth mechanism changes (e.g., key rotation, header format), every file needs updating.

## Analysis of Options

**Option 1: Wrapper script `brain-curl.sh`** — All skills call this instead of raw curl.
- Pro: Single point of auth, simple
- Con: Adds a script dependency, skills already generate complex curl commands

**Option 2: Session launcher pre-configures curl alias** — `alias brain-curl='curl -H "Authorization: Bearer $BRAIN_API_KEY"'`
- Pro: Zero changes to skills, just set alias in tmux env
- Con: Aliases don't work in non-interactive contexts, unreliable

**Option 3: Brain API accepts env-based auth** — API reads key from request header OR falls back to localhost exemption
- Pro: Eliminates header entirely for local calls
- Con: Weakens security model, requires API code change

**Recommendation: Option 1 — wrapper script.** Simple, reliable, centralized.

## Design

### Change A: Create `brain-curl.sh` wrapper

Location: `xpollination-best-practices/scripts/brain-curl.sh`

```bash
#!/bin/bash
# Brain API curl wrapper — centralizes auth header
# Usage: brain-curl.sh [curl args...]
# Example: brain-curl.sh -s -X POST http://localhost:3200/api/v1/memory -d '{"prompt":"..."}'

exec curl -H "Content-Type: application/json" \
     -H "Authorization: Bearer ${BRAIN_API_KEY:?BRAIN_API_KEY not set}" \
     "$@"
```

The `${BRAIN_API_KEY:?}` pattern fails with a clear error if the env var is missing. The `exec` replaces the shell process (no overhead).

### Change B: Update all skill files

Replace all `curl -s ... -H "Authorization: Bearer $BRAIN_API_KEY"` patterns with calls to the wrapper:

```bash
# Before:
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d '{"prompt":"..."}'

# After:
brain-curl -s -X POST http://localhost:3200/api/v1/memory \
  -d '{"prompt":"..."}'
```

Note: Content-Type is also in the wrapper, so it can be removed from individual calls.

Skills must add the wrapper to PATH or use full path. Since `claude-session.sh` already sets up the environment, add the scripts directory to PATH there.

### Change C: Add to PATH in session launcher

In `claude-session.sh`, add:
```bash
export PATH="$PATH:/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/scripts"
```

This makes `brain-curl` available to all agents without full path.

### Files Changed

1. `xpollination-best-practices/scripts/brain-curl.sh` — new wrapper script
2. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.brain/SKILL.md` — replace 4 curl calls
3. `xpollination-best-practices/.claude/skills/xpo.claude.clear/SKILL.md` — replace 1 curl call
4. `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` — replace 3 curl calls, remove AUTH_HDR
5. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.reflect/SKILL.md` — replace 8 curl calls
6. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.garden/SKILL.md` — replace 2 curl calls
7. `HomeAssistant/.../claude-session.sh` — add scripts dir to PATH

### Testing

1. `brain-curl -s http://localhost:3200/api/v1/health` returns 200
2. `brain-curl -s -X POST http://localhost:3200/api/v1/memory -d '{"prompt":"test","read_only":true}'` returns results
3. Without BRAIN_API_KEY set: `brain-curl` fails with clear error message
4. All updated skill curl commands still work (brain query/contribute)
