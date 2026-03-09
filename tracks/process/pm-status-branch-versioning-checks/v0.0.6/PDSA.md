# PDSA: PM Status Skill — Remove Skill Split, Correct Prod Port

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.6
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.5 included two issues:
1. Recommended splitting the PM status skill into pm.scan + pm.drill — LIAISON evaluated this and concluded it saves nothing (always drill down, scan is 10 lines of logic). This recommendation must be removed.
2. Documented prod deployment on port 4100, but production actually runs on port 8080. The migration from 8080→4100 hasn't happened yet. The deployment guidance must reflect reality.

## Analysis

### Skill split removal

The v0.0.5 PDSA recommended splitting `/xpo.claude.mindspace.pm.status` into `/xpo.claude.mindspace.pm.scan` (fast summary) and `/xpo.claude.mindspace.pm.drill` (detailed review). LIAISON evaluated this and determined:
- Thomas always wants the drill-down after the summary
- The scan logic is ~10 lines (one pm-status.cjs call + parse)
- Splitting adds complexity (two skills to maintain) without saving time or tokens
- Template compression is a separate concern handled by LIAISON

Remove all references to skill splitting from the design. Other optimization findings (brain health caching, lazy DNA loading) remain valid observations but are not actionable in this task.

### Prod port correction

Current infrastructure:
- **TEST**: `mindspace-test.service` on port 4200 (VPN-only, develop branch) — correct in v0.0.5
- **PROD**: `mindspace.service` on port 8080 (not 4100 as v0.0.5 stated)
- **Future**: Port migration planned from 8080→4100

The deployment action guidance must:
- Document current state: PROD=8080, TEST=4200
- Note the planned migration to 4100 but not assume it's done
- Deployment option should say "Deploy to PROD (8080)" not "Deploy to PROD (4100)"
- Include migration steps: update mindspace.service ExecStart to bind to 4100, update nginx/firewall rules

## Design

### Change I: Remove skill split from v0.0.5 performance reflection

Remove from the PDSA design all references to:
- Split skill into pm.scan + pm.drill
- `/xpo.claude.mindspace.pm.scan` and `/xpo.claude.mindspace.pm.drill`

Keep other valid performance observations (brain health caching, lazy DNA loading, template compression) as informational — these may inform future tasks but are not designed or implemented here.

### Change J: Correct deployment action guidance port numbers

Update the DEPLOYMENT ACTION section designed in v0.0.5:

```markdown
   Options:
   - "Deploy to TEST (4200)" — updates symlink in develop worktree, restarts mindspace-test.service
   - "Deploy to PROD (8080)" — updates symlink in main worktree, restarts mindspace.service
   - "Skip deployment" — leave as-is

   Current infrastructure:
   - TEST: mindspace-test.service, port 4200, develop branch worktree
   - PROD: mindspace.service, port 8080, main branch
   - PLANNED: port migration 8080→4100 (not yet executed)

   Execution (PROD deployment):
   ```bash
   # 1. Update symlink in main worktree
   ln -sfn versions/v0.0.X <main-repo-path>/viz/active

   # 2. Restart service (requires thomas user)
   sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace.service"

   # 3. Verify
   curl -s http://localhost:8080/api/version
   ```

   Port migration steps (when ready):
   1. Update mindspace.service ExecStart to bind port 4100
   2. Update nginx proxy config if applicable
   3. Update firewall rules (allow 4100, remove 8080)
   4. Restart service and verify on new port
   5. Update this skill to reflect port 4100
```

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — corrected deployment ports and removed skill split

### Testing

1. No references to pm.scan or pm.drill skill split in the design
2. PROD deployment option shows port 8080 (not 4100)
3. TEST deployment option shows port 4200 (unchanged)
4. Current infrastructure state documented (PROD=8080, TEST=4200)
5. Port migration steps documented as future work
6. Verification curl uses port 8080 for PROD
7. All v0.0.1-v0.0.4 changes preserved
8. All commits on develop branch
