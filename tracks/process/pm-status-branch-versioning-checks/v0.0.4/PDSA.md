# PDSA: PM Status Skill — Deployment Verification Check

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.4
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.3 addressed style guide, HUMAN APPROVAL rename, and AskUserQuestion for SEMI mode. A 6th requirement was identified: tasks that create new viz versions or claim deployment may not actually be deployed. The viz-dependency-badge-colors task created v0.0.10 and was marked complete, but the `viz/active` symlink still points to v0.0.9. The fix exists on disk but is not serving.

LIAISON needs an automated check to catch this gap during drill-down.

## Analysis

The viz deployment model uses:
- `viz/versions/v0.0.X/` — version directories with the actual code
- `viz/active` — symlink pointing to the currently deployed version
- A server at `http://10.33.33.1:4200` (or `localhost:4200`) serving from the active symlink

The deployment gap pattern:
1. DEV creates `viz/versions/v0.0.10/` and commits
2. Task is marked complete
3. Nobody runs `ln -sfn versions/v0.0.10 viz/active`
4. Server still serves v0.0.9

Detection is straightforward:
- Read the `viz/active` symlink target → get deployed version
- List `viz/versions/` → get latest version
- If latest > deployed → deployment not executed
- Optionally curl the server to verify it's actually running

This check applies only to tasks in the `xpollination-mcp-server` project that touch viz (group=`viz` or slug contains `viz-`). For other projects or non-viz tasks, this check is N/A.

## Design

### Change F: Add DEPLOYMENT VERIFICATION check to SKILL.md Step 3

Add as a 4th verification check after REF VALIDATION, before the "If any check shows VIOLATION or WARN" summary rule:

```markdown
   **DEPLOYMENT VERIFICATION** (for viz-related tasks in xpollination-mcp-server):
   Applies when: task slug contains `viz-` OR task group is `viz` AND project is `xpollination-mcp-server`.

   ```bash
   # 1. Read active symlink
   readlink <project-repo-path>/viz/active
   ```
   Expected output: `versions/v0.0.X`

   ```bash
   # 2. List all versions, find latest
   ls -d <project-repo-path>/viz/versions/v*/ | sort -V | tail -1
   ```

   ```bash
   # 3. (Optional) Check if server is running and which version it reports
   curl -s http://localhost:4200/api/version 2>/dev/null || echo "server not reachable"
   ```

   - If latest version directory > active symlink version: **WARN** — version `v0.0.X` exists but `active` symlink points to `v0.0.Y`. Deployment not executed.
   - If latest version = active symlink version: **OK**
   - If not a viz task or not xpollination-mcp-server: **N/A**
   - If server unreachable: append "(server not reachable — cannot verify runtime)" to status
```

### Change F2: Add DEPLOYMENT VERIFICATION header to presentation template

Add after the REF VALIDATION header line in the template:

```
DEPLOYMENT VERIFICATION: OK | WARN (v0.0.10 exists, active → v0.0.9) | N/A
```

### Change F3: Update good example

Add a DEPLOYMENT VERIFICATION line to the good example (N/A for the example since it's not a viz task, or show a sample WARN).

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — add deployment verification check, header, and example update

### Testing

1. SKILL.md contains "DEPLOYMENT VERIFICATION" check instructions
2. Check reads `viz/active` symlink with `readlink`
3. Check lists `viz/versions/` and finds latest with `sort -V`
4. Check applies only to viz-related tasks in xpollination-mcp-server
5. WARN when latest version > active symlink version
6. OK when latest = active
7. N/A for non-viz tasks
8. Header appears in presentation template after REF VALIDATION
9. Good example includes DEPLOYMENT VERIFICATION line
10. WARN routed to RECOMMENDATION section (existing rule covers this)
11. All v0.0.1-v0.0.3 changes preserved
12. All commits on develop branch
