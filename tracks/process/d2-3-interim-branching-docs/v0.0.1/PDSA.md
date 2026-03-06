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

### Change B: Full branching rules in project CLAUDE.md files

**Why CLAUDE.md, not just SKILL.md:** CLAUDE.md is loaded into every agent context at session start AND survives context compaction. Skills are only loaded at wake-up. Putting the full rules in CLAUDE.md guarantees every agent has them at all times, even mid-session after compaction.

Add the full branching rules block (not just a pointer) to the Git Protocol section of each project's CLAUDE.md:

```markdown
## Branching Rules (Interim)

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
**If unsure which branch:** Default to `develop`.
```

Files to update:
- `xpollination-mcp-server/CLAUDE.md` — add after Git Protocol section
- `xpollination-best-practices/CLAUDE.md` (if exists) — add after Git Protocol section
- `HomePage/CLAUDE.md` (if exists) — add after Git Protocol section

### Change C: Brain contribution for immediate awareness

Contribute the branching rules to brain as an operational learning. This ensures agents querying brain for recovery/context pick up the rules immediately, even before their next restart.

```bash
curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d '{"prompt":"BRANCHING RULES (INTERIM): NEVER commit to main. All work on develop or feature/cap-* branches. Workflow: checkout develop, for multi-task work create feature/cap-<slug>, single-task fixes go directly on develop. Never merge to main (Thomas only). Test on 10.33.33.1:4200 before merging to develop.","agent_id":"agent-dev","agent_name":"DEV","thought_category":"operational_learning","topic":"branching-rules"}'
```

### Propagation Plan (Deterministic Enforcement)

| Layer | What | When enforced | Survives compaction? |
|-------|------|---------------|---------------------|
| CLAUDE.md | Full rules in Git Protocol section | Every session, survives compaction | Yes |
| SKILL.md | Full rules in monitor skill | Every wake-up (`/xpo.claude.monitor`) | N/A (loaded at start) |
| Brain | Operational learning contribution | On recovery queries, compact-recover hook | N/A (external) |

**Deterministic enforcement point:** After DEV commits Changes A+B+C and pushes:
1. **Next session start** — CLAUDE.md loads automatically → rules active
2. **Next wake-up** — SKILL.md loads via monitor skill → rules active
3. **Next compact-recover** — Brain query returns rules → rules active
4. **Currently running agents** — Will NOT have rules until restart or compaction

**Guarantee:** After all running agents restart (or compact), 100% coverage is achieved. The only gap is currently-running agents that haven't compacted yet. This is acceptable because agents restart daily and compact frequently.

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.monitor/SKILL.md` — add branching rules section
2. `xpollination-mcp-server/CLAUDE.md` — add full branching rules
3. `xpollination-best-practices/CLAUDE.md` — add full branching rules (if exists)
4. `HomePage/CLAUDE.md` — add full branching rules (if exists)
5. Brain contribution — operational learning via curl

### Testing

1. Monitor SKILL.md contains "Branching Rules (Interim)" section
2. Section mentions `develop`, `feature/cap-*`, and `main` with correct rules
3. "NEVER commit directly to main" is present
4. Test system URL `10.33.33.1:4200` is mentioned
5. Branch prefix `feature/cap-*` is documented
6. Project CLAUDE.md files contain **full** branching rules (not just a pointer)
7. Brain contains branching rules operational learning
8. CLAUDE.md rules match SKILL.md rules (no divergence)
