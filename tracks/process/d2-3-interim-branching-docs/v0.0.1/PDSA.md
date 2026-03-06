# PDSA: Interim Branching Rules in Agent SKILL.md

**Task:** d2-3-interim-branching-docs
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

Agents currently have no branching rules — they commit directly to main. With the develop branch now created (d2-1-develop-branch), agents need documented rules for where to build and how to branch. Without this, agents will continue committing to main, defeating the purpose of the branching strategy.

## Analysis

REQ-BRANCH-001 defines a Modified GitFlow with three tiers:
1. `main` — production, never commit directly
2. `develop` — integration branch
3. `feature/*` — per-capability branches

The task description specifies:
- Feature branches per capability (not per task)
- Branch prefix: `feature/cap-*`
- Test system URL: `10.33.33.1:4200`

## Design

### Change A: Add "Branching Rules" section to monitor SKILL.md

Insert a new `### Branching Rules (Interim)` section after the existing `### Git Protocol` section in `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`.

Content:

```markdown
### Branching Rules (Interim)

**NEVER commit directly to `main`.** All agent work goes on `develop` or feature branches.

| Branch | Purpose | Who merges |
|--------|---------|------------|
| `main` | Production — frozen | Thomas only |
| `develop` | Integration — default work branch | Agents (via merge) |
| `feature/cap-*` | Per-capability feature branches | DEV agent creates, merges to develop |

**Workflow:**
1. Start on `develop`: `git checkout develop && git pull`
2. For capability work (multi-task): create feature branch: `git checkout -b feature/cap-<capability-slug>`
3. For single-task fixes: commit directly to `develop`
4. When feature is complete: merge to develop: `git checkout develop && git merge feature/cap-<slug>`
5. **Never** merge to `main` — Thomas handles main releases

**Branch naming:** `feature/cap-<capability-slug>` (e.g., `feature/cap-a11-a2a-protocol`)

**Test system:** Verify on `http://10.33.33.1:4200` before merging to develop.

**If you're unsure which branch to use:** Default to `develop`.
```

### Change B: Add reminder to project CLAUDE.md files

Add a one-line reminder to each project's CLAUDE.md pointing to the branching rules in the skill:

```markdown
**Branching:** See `xpo.claude.monitor` skill for branching rules. Never commit to `main`.
```

This goes in the Git Protocol section of:
- `xpollination-mcp-server/CLAUDE.md`
- `xpollination-best-practices/CLAUDE.md` (if exists)
- `HomePage/CLAUDE.md` (if exists)

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` — add branching rules section
2. `xpollination-mcp-server/CLAUDE.md` — add one-line branching reminder
3. `HomePage/CLAUDE.md` — add one-line branching reminder (if file exists)

### Testing

1. Monitor SKILL.md contains "Branching Rules (Interim)" section
2. Section mentions `develop`, `feature/cap-*`, and `main` with correct rules
3. "NEVER commit directly to main" is present
4. Test system URL `10.33.33.1:4200` is mentioned
5. Branch prefix `feature/cap-*` is documented
6. Project CLAUDE.md files reference the branching rules
