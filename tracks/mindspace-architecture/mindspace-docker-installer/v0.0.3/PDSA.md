# PDSA: Docker Containerization + Self-Documenting Installer (v0.0.3 — Full Consolidation)

**Task:** `mindspace-docker-installer`
**Version:** v0.0.3
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.2 (scope expanded: move EVERYTHING from best-practices, zero co-dependency)

---

## PLAN

### Rework Context

v0.0.2 moved Brain API, skills, and hooks. Thomas rejected — not enough:

> "Move EVERYTHING from best-practices. No governance docs, no tracks stay behind. Zero co-dependency between repos. One self-contained project. History must be available for agents to project correctly."

This is a full repo consolidation. `xpollination-best-practices` becomes archived/empty. `xpollination-mcp-server` IS Mindspace — complete and self-contained.

### Inventory of xpollination-best-practices (206+ files)

| Category | Count | What |
|----------|-------|------|
| Root governance | 5 | README.md, AGENTS.md, CONTRIBUTING.md, LICENSE, CHANGELOG.md |
| Brain API | 45+ | Fastify server, routes, services, tests, middleware, MCP |
| Skills | 12 | 7 skill directories with SKILL.md + versions |
| Scripts/hooks | 15 | Deployment, hooks, settings sync, backups |
| Tracks | 124 | 4 major tracks: agent-operations, brain-infrastructure, knowledge-management, mindspace-architecture |
| Data | 2 | xpollination.db (32KB), thought-tracing.db (empty) |

### Design Decisions

**D1–D4, D6–D8: UNCHANGED from v0.0.1.**

**D5 (v0.0.2): 3-service compose — UNCHANGED.** mindspace + qdrant + brain.

**D9 (v0.0.2): Dockerfile.brain — UNCHANGED.**

**D10 (v0.0.2): Brain API to `brain/` — UNCHANGED.**

**D11 (v0.0.2): Skills to `.claude/skills/` — UNCHANGED.**

**D12 (v0.0.2): Hooks to `scripts/hooks/` — UNCHANGED.**

**D13 (v0.0.2): XPO_WORKSPACE_PATH env var — UNCHANGED.**

**D14 (v0.0.2): 6-step startup — UNCHANGED.**

**D15 (v0.0.2): HuggingFace model cache volume — UNCHANGED.**

**D16 (NEW): Governance docs merge into repo root.**

| Source (best-practices) | Destination (mcp-server) | Strategy |
|------------------------|--------------------------|----------|
| `AGENTS.md` | `AGENTS.md` | Copy (mcp-server has none) |
| `CONTRIBUTING.md` | `CONTRIBUTING.md` | Copy (mcp-server has none) |
| `LICENSE` | `LICENSE` | Copy (mcp-server has none — inherits AGPL v3) |
| `CHANGELOG.md` | `CHANGELOG.md` | Copy (mcp-server has none) |
| `README.md` | Merge into existing `README.md` or replace | mcp-server README may exist — merge vision section |

**D17 (NEW): Tracks merge into existing `tracks/` directory.**

Best-practices has 4 track categories with 124 files:

| Source Track | Destination | Conflict? |
|-------------|-------------|-----------|
| `tracks/agent-operations/` | `tracks/agent-operations/` | No conflict — mcp-server has no agent-operations track |
| `tracks/brain-infrastructure/` | `tracks/brain-infrastructure/` | No conflict — new track |
| `tracks/knowledge-management/` | `tracks/knowledge-management/` | No conflict — new track |
| `tracks/mindspace-architecture/` | `tracks/mindspace-architecture/` | **POTENTIAL CONFLICT** — mcp-server already has this track with `mindspace-api-deployment/` and `mindspace-docker-installer/` |

For `mindspace-architecture/`: best-practices has versions v0.0.1–v0.0.7 and `content-addressable-thought-architecture/`. mcp-server has `mindspace-api-deployment/` and `mindspace-docker-installer/`. These are distinct subdirectories — merge adds best-practices entries alongside existing ones. No file-level conflicts.

**D18 (NEW): Git history preservation via `git subtree` or file copy.**

Two options:

**Option A: `git subtree add`** — Preserves full commit history from best-practices as part of mcp-server history. Commands:
```bash
git remote add best-practices ../xpollination-best-practices
git subtree add --prefix=_imported/best-practices best-practices main --squash
# Then move files from _imported/best-practices/ to their final locations
```
Pro: Full history searchable via `git log`. Con: Creates a large merge commit with all 206+ files at once.

**Option B: File copy + attribution commit** — Copy files, create commit with message referencing source repo and commit hash. Pro: Clean, simple. Con: History requires checking the old repo.

**Recommendation: Option B (file copy).** Rationale:
1. The tracks/ content is PDSA documents — their content IS the history (each version documents what changed and why)
2. Brain API changes are tracked in brain-infrastructure tracks
3. Agents don't use `git log` for projections — they read tracks/ documents
4. Subtree adds complexity to future git operations (rebase, cherry-pick)
5. A single "consolidation" commit with clear message provides sufficient traceability

The commit message should reference the source:
```
consolidation: absorb xpollination-best-practices into mindspace

Source: github.com/XPollination/xpollination-best-practices
Last commit: <hash>
Reason: Zero co-dependency — one self-contained Mindspace project
Plateau: PLATEAU-001

Files moved:
- api/ → brain/
- .claude/skills/ → .claude/skills/
- scripts/ → scripts/hooks/ and scripts/
- tracks/ → tracks/ (merged)
- Root docs → root (AGENTS.md, CONTRIBUTING.md, LICENSE, CHANGELOG.md)
```

**D19 (NEW): Scripts consolidation.**

Best-practices has 15 scripts. Group by purpose:

| Script | Destination | Notes |
|--------|-------------|-------|
| `deploy-brain-api.sh` | `scripts/deploy/` | Update hardcoded paths to relative |
| `qdrant-backup.sh` | `scripts/backup/` | Keep as-is |
| `qdrant-backup-test.sh` | `scripts/backup/` | Keep as-is |
| `test-qdrant-backup.sh` | `scripts/backup/` | Keep as-is |
| `brain-cleanup-test-data.js` | `scripts/maintenance/` | Keep as-is |
| `new-version.sh` | `scripts/` | Version tagging — project-wide |
| `seal-version.sh` | `scripts/` | Version sealing — project-wide |
| `skill-version-check.sh` | `scripts/hooks/` | Pre-tool hook |
| `test-reflection-skill.sh` | `scripts/` | Test utility |
| `xpo.claude.brain-first-hook.sh` | `scripts/hooks/` | Claude hook |
| `xpo.claude.brain-writeback-hook.sh` | `scripts/hooks/` | Claude hook |
| `xpo.claude.compact-recover.sh` | `scripts/hooks/` | Claude hook |
| `xpo.claude.precompact-save.sh` | `scripts/hooks/` | Claude hook |
| `xpo.claude.sync-settings.js` | `scripts/` | Settings merger |
| `xpo.claude.settings.json` | `scripts/` | Hook config template |

**D20 (NEW): Data directory — no action needed.**

mcp-server already has `data/xpollination.db` (the primary PM database). Best-practices has a 32KB copy and an empty thought-tracing.db. Brain API creates its own thought-tracing.db at `brain/data/thought-tracing.db` (Docker volume). No data files need to move.

**D21 (NEW): .gitignore merge.**

Best-practices `.gitignore` adds: `data/xpollination.db`, `*.db-shm`, `*.db-wal`. mcp-server's existing `.gitignore` likely already covers these. Merge any missing patterns.

**D22 (NEW): best-practices repo archival.**

After consolidation:
1. Replace README.md with deprecation notice pointing to xpollination-mcp-server
2. Mark repo as archived on GitHub (read-only)
3. Keep for historical reference — don't delete

### Files to Create/Modify (Complete List)

| File | Action | Source |
|------|--------|--------|
| `brain/` | **COPY** | best-practices/api/ |
| `brain/package.json` | Copy | best-practices/api/package.json |
| `Dockerfile.brain` | **CREATE** | New (from v0.0.2 design) |
| `docker-compose.yml` | **MODIFY** | Add qdrant + brain services |
| `docker-compose.dev.yml` | **MODIFY** | Add brain dev overrides |
| `scripts/startup.sh` | **MODIFY** | Add brain health step |
| `.claude/skills/` | **COPY** | best-practices/.claude/skills/ (all 7) |
| `scripts/hooks/` | **COPY** | best-practices/scripts/xpo.claude.*.sh + skill-version-check.sh |
| `scripts/deploy/` | **COPY** | best-practices/scripts/deploy-brain-api.sh |
| `scripts/backup/` | **COPY** | best-practices/scripts/qdrant-backup*.sh |
| `scripts/maintenance/` | **COPY** | best-practices/scripts/brain-cleanup-test-data.js |
| `scripts/xpo.claude.sync-settings.js` | **COPY** | best-practices/scripts/ |
| `scripts/xpo.claude.settings.json` | **COPY** | best-practices/scripts/ |
| `scripts/new-version.sh` | **COPY** | best-practices/scripts/ |
| `scripts/seal-version.sh` | **COPY** | best-practices/scripts/ |
| `AGENTS.md` | **COPY** | best-practices/AGENTS.md |
| `CONTRIBUTING.md` | **COPY** | best-practices/CONTRIBUTING.md |
| `LICENSE` | **COPY** | best-practices/LICENSE |
| `CHANGELOG.md` | **COPY** | best-practices/CHANGELOG.md |
| `tracks/agent-operations/` | **COPY** | best-practices/tracks/agent-operations/ |
| `tracks/brain-infrastructure/` | **COPY** | best-practices/tracks/brain-infrastructure/ |
| `tracks/knowledge-management/` | **COPY** | best-practices/tracks/knowledge-management/ |
| `tracks/mindspace-architecture/` | **MERGE** | best-practices/tracks/mindspace-architecture/ (add non-conflicting subdirs) |
| `viz/discover-projects.cjs` | **MODIFY** | Update default path fallback |
| `viz/agent-monitor.cjs` | **MODIFY** | Update default path fallback |
| `.dockerignore` | **MODIFY** | Add brain-specific excludes |
| `.gitignore` | **MERGE** | Add missing patterns from best-practices |

### Risks and Mitigations

**R1–R7: UNCHANGED from v0.0.2.**

**R8 (REVISED): Repo consolidation — large change.** 206+ files in a single consolidation. Risk: merge conflicts, broken references. Mitigation: File copy (D18 Option B) is atomic — one commit with all files. No git subtree complexity.

**R9 (NEW): Track conflicts in mindspace-architecture/.** Best-practices has subdirectories that don't exist in mcp-server (v0.0.1–v0.0.7 architecture specs, content-addressable-thought-architecture). mcp-server has subdirectories that don't exist in best-practices (mindspace-api-deployment, mindspace-docker-installer). No file-level conflicts — merge is additive.

**R10 (NEW): Hook scripts reference best-practices paths.** Several hook scripts have hardcoded paths like `/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/`. After consolidation, these must point to `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/` or use relative paths. DEV must update all absolute paths in copied scripts.

**R11 (NEW): Skill SKILL.md files reference best-practices paths.** The `xpo.claude.monitor` skill references paths like `xpollination-best-practices/.claude/skills/...`. After consolidation, installation symlinks point to this repo. Update all references.

**R12 (NEW): API test files may reference best-practices-specific paths.** Brain API tests may assume they run from best-practices root. After move to `brain/`, relative paths in tests should still work since internal structure is preserved.

### Verification Plan

1–12: **ALL items from v0.0.2 still apply.**

13. `ls AGENTS.md CONTRIBUTING.md LICENSE CHANGELOG.md` — governance docs present at root
14. `ls tracks/agent-operations/ tracks/brain-infrastructure/ tracks/knowledge-management/` — all 3 new track categories present
15. `ls tracks/mindspace-architecture/` — merged: contains both best-practices entries AND existing mcp-server entries
16. `ls scripts/hooks/xpo.claude.*.sh` — all hook scripts present
17. `ls scripts/backup/ scripts/deploy/ scripts/maintenance/` — utility scripts organized
18. `grep -r "xpollination-best-practices" scripts/ .claude/ brain/` — no remaining hardcoded references to old repo
19. All brain API tests pass from new location: `cd brain && npm test`
20. `.gitignore` covers `*.db-shm`, `*.db-wal`

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
