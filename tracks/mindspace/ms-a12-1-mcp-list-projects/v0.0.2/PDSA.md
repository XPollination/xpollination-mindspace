# PDSA: mindspace_list_projects MCP tool — Rework

**Task:** ms-a12-1-mcp-list-projects
**Version:** v0.0.2
**Author:** DEV agent (rework)
**Date:** 2026-03-10
**Parent:** v0.0.1

## Rework Context

Liaison rework reason (verbatim): "REWORK: (1) Commit 6ad119c is on main only — must be on develop. (2) PROD viz symlink mismatch — active points to v0.0.4 but running process serves v0.0.9. Both issues must be resolved: commit moved to develop, viz symlink and running version aligned. No assumptions — fix infrastructure state now to avoid compounding problems."

## Changes from v0.0.1

No design changes. v0.0.1 implementation is correct. Rework addresses infrastructure issues only:

1. **Cherry-pick to develop:** Commit 6ad119c (main) cherry-picked to develop as 2c2d92d
2. **Viz symlink alignment:** Updated `viz/active` symlink from v0.0.4 → v0.0.11 (latest), restarted viz processes on ports 4100 + 4200. Commit 429cec1 on main.

## Verification

12/12 QA tests pass after cherry-pick. No code changes required.
