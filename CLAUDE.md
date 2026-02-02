# CLAUDE.md

Project-specific instructions for Claude Code agents working in xpollination-mindspace.

## Project Overview

Mindmap-based project management tool for human-agent alignment. Uses PDSA (Plan-Do-Study-Act) methodology.

## Git Protocol (MANDATORY)

1. **Specific file staging only** — NEVER `git add .` or `git add -A`
2. **Atomic commands** — no `&&` chaining
3. **One-liner commits** — `git commit -m "type: description"`
4. **Immediate push** after every commit
5. **Ask before destructive operations** (force push, reset --hard)

## Directory Structure

```
xpollination-mindspace/
├── README.md           # Project overview
├── CLAUDE.md           # This file — agent instructions
└── docs/
    └── pdsa/           # All PDSA documents
```

## PDSA Documents

All significant operations documented as PDSA cycles in `docs/pdsa/`.

**Filename pattern:** `YYYY-MM-DD-UTC-HHMM.<operation-name>.pdsa.md`

## Dual-Link Pattern

Every cross-repo reference must include both forms:
- **Human-readable:** GitHub URL (e.g., `https://github.com/PichlerThomas/HomeAssistant/blob/main/...`)
- **Agent-readable:** Local filesystem path (e.g., `/home/developer/workspaces/github/PichlerThomas/HomeAssistant/...`)
