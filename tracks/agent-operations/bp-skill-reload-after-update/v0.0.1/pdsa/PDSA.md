# PDSA: Skills Not Reloaded After Update — Stale Cache

**Task:** bp-skill-reload-after-update
**Version:** v0.0.1
**Status:** Design

## Plan

### Root Cause Analysis

Claude Code loads skill SKILL.md content on first `/skill` invocation via the Skill tool. The content enters the LLM conversation context as a message. Once in context, it stays there — there is no mechanism to reload or replace it. This is an inherent property of how LLM conversations work: prior messages are immutable.

**This is a Claude Code architecture limitation, not a bug.**

### Impact

When a skill is updated mid-session (file modified, symlink changed):
- All subsequent invocations use the cached (old) version
- Agent operates on stale instructions
- Only `/clear` forces a fresh skill load on next invocation

### Proposed Solution: Pre-Skill Checksum Hook

A `PreToolUse` hook on the Skill tool that:
1. Computes the current SKILL.md checksum before loading
2. Compares against a stored checksum from the last load
3. If mismatch detected, injects a warning into the hook output

#### Implementation

**Hook script:** `xpollination-best-practices/scripts/xpo.claude.skill-version-check.sh`

```bash
#!/bin/bash
# PreToolUse hook for Skill tool
# Detects if SKILL.md changed since last invocation

SKILL_NAME="$1"
SKILL_PATH=$(find ~/.claude/skills -name "$SKILL_NAME" -maxdepth 1 2>/dev/null)/SKILL.md
CACHE_DIR="/tmp/claude-skill-checksums"
mkdir -p "$CACHE_DIR"

if [ ! -f "$SKILL_PATH" ]; then
  exit 0  # skill not found, let Skill tool handle it
fi

CURRENT_HASH=$(sha256sum "$SKILL_PATH" | cut -d' ' -f1)
CACHE_FILE="$CACHE_DIR/$SKILL_NAME.hash"

if [ -f "$CACHE_FILE" ]; then
  CACHED_HASH=$(cat "$CACHE_FILE")
  if [ "$CURRENT_HASH" != "$CACHED_HASH" ]; then
    echo "WARNING: Skill '$SKILL_NAME' has been updated since last load. Cached version is stale. Run /clear to reload with the updated skill."
  fi
fi

echo "$CURRENT_HASH" > "$CACHE_FILE"
exit 0
```

#### Hook Configuration (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "bash xpollination-best-practices/scripts/xpo.claude.skill-version-check.sh $TOOL_INPUT"
          }
        ]
      }
    ]
  }
}
```

### Alternative Considered: /compact Instead of /clear

`/compact` preserves context but may still cache the old skill content in the compacted summary. `/clear` is the only reliable way to force a fresh skill load.

### Files to Create

1. `xpollination-best-practices/scripts/xpo.claude.skill-version-check.sh` — hook script
2. `xpollination-best-practices/scripts/xpo.claude.settings.json` — UPDATE: add PreToolUse hook

### Acceptance Criteria

- Hook detects skill file changes between invocations
- Warning message appears when stale skill detected
- No false positives on first invocation (no cached hash yet)
- Hook does not block skill execution (exit 0 always)

## Do

Implementation by DEV agent.

## Study

- Verify hook fires on Skill tool use
- Verify checksum comparison detects file changes
- Verify warning appears in agent output
- Verify no impact when skill hasn't changed

## Act

Document the limitation in CLAUDE.md global instructions. Add operational guidance: "After updating any skill, all active agents must /clear to pick up changes."
