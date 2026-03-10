# Changelog: workflow-complete-role-reset v0.0.4

## v0.0.4 — 2026-03-10

**Rework of v0.0.3** — complete tracks structure investigation + reconciliation plan + main-first deployment.

### What changed from v0.0.3

| Aspect | v0.0.3 | v0.0.4 |
|--------|--------|--------|
| Investigation | .js files only | Full tracks structure, WORKFLOW.md locations, CLAUDE.md refs, symlinks |
| Target branch | develop | **main** (live infrastructure) |
| Reconciliation | Not addressed | v16/v0.0.16 naming, missing symlink, stale CLAUDE.md refs |
| Design | Same enforcement | Same enforcement + reconciliation steps |

### Investigation findings

- Engine .js files: identical between main and develop (confirmed again)
- WORKFLOW.md: same content, different locations (`v16` on main, `v0.0.16` on develop)
- Main has symlink `WORKFLOW.md → workflow/v16/WORKFLOW.md`, develop does not
- Main CLAUDE.md has stale ref `docs/WORKFLOW.md (v12)` — develop has correct ref
- Develop has ~30 more track files (PDSAs/changelogs) not yet on main

### Rework feedback (verbatim from Thomas)

> "REWORK — PDSA INVESTIGATION WAS INCOMPLETE [...] Both PROD (4100) and TEST (4200) run the same workflow engine against the SAME production DB. The workflow is LIVE INFRASTRUCTURE, not a develop-only feature."
