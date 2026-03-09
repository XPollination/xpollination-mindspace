# PDSA: PM Status Skill — Deployment Action Guidance + Performance Reflection

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.5
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.4 added deployment verification detection but lacks resolution guidance. When LIAISON detects a deployment gap (version exists but symlink not updated), it doesn't know HOW to deploy or what options to present. Additionally, Thomas observes the PM status skill takes ~10 seconds and ~1000 tokens per invocation — a reflection on optimization opportunities is needed.

## Analysis

### Deployment Infrastructure

Current setup:
- `viz/active` symlink → `versions/v0.0.X/` (currently → v0.0.9)
- `mindspace-test.service` — serves from `viz/active` on port 4200 (VPN-only, develop branch)
- Test server: `http://10.33.33.1:4200`
- No production service currently (future: port 4100 or similar)

Deployment steps:
1. Update symlink: `ln -sfn versions/v0.0.X viz/active`
2. Restart service: `systemctl restart mindspace-test.service` (requires thomas user for systemctl)
3. Verify: `curl -s http://localhost:4200` returns expected version

Since `developer` user has no sudo, deployment commands requiring service restart need `sshpass -p 'PASSWORD' ssh thomas@localhost "systemctl restart mindspace-test.service"`. LIAISON should present options and execute the selected action.

### Performance Reflection

The PM status skill has 3 time/token consumers:

1. **pm-status.cjs scan** (~3-4s): Scans 3 project databases + brain health in one Node.js call. This is efficient — single process, parallel DB queries. Optimization: marginal.

2. **Skill text loading** (~500-600 tokens): The full SKILL.md (284 lines) is loaded into context on every invocation. The verification checks, good/bad examples, and mode instructions account for ~60% of token cost. Optimization opportunity: split skill into a scan-only mode (fast summary, no drill-down) vs full drill-down mode.

3. **Drill-down per task** (~200-300 tokens each): Each task requires DNA retrieval, verification checks (bash commands), and structured presentation. With 5+ actionable tasks, this compounds. Optimization opportunity: batch verification checks, lazy-load DNA only for tasks Thomas wants to review.

**Refactoring opportunities identified:**
- **Split skill**: `/xpo.claude.mindspace.pm.scan` (fast summary table, ~100 tokens) vs `/xpo.claude.mindspace.pm.drill <slug>` (full drill-down for one task, ~400 tokens). Reduces cold-start cost when Thomas just wants the overview.
- **Cache brain health**: Brain health rarely changes within a PM session. Cache for 5 minutes.
- **Lazy DNA loading**: Don't load all task DNA upfront — load per-task during drill-down.
- **Template compression**: The good/bad examples are instructional, not runtime. Move to a separate EXAMPLES.md file imported only when needed.

These are findings only — no implementation in this task. A future optimization task should be created.

## Design

### Change G: Deployment Action Guidance in SKILL.md

Add a new section after the DEPLOYMENT VERIFICATION check instructions, inside Step 3:

```markdown
   **DEPLOYMENT ACTION** (when DEPLOYMENT VERIFICATION shows WARN):
   When a deployment gap is detected, present Thomas with deployment options using AskUserQuestion:

   Options:
   - "Deploy to TEST (4200)" — updates symlink + restarts mindspace-test.service
   - "Deploy to PROD (4100)" — updates symlink + restarts mindspace.service (future)
   - "Skip deployment" — leave as-is

   Execution (TEST deployment):
   ```bash
   # 1. Update symlink (developer user can do this)
   ln -sfn versions/v0.0.X <project-repo-path>/viz/active

   # 2. Restart service (requires thomas user)
   sshpass -p '<password>' ssh thomas@localhost "systemctl restart mindspace-test.service"

   # 3. Verify
   curl -s http://localhost:4200/api/version
   ```

   Credentials: read from `HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md`

   After deployment, update the DEPLOYMENT VERIFICATION status from WARN to OK in the presentation.
```

### Change H: Performance Reflection section in PDSA

This PDSA document itself contains the reflection (see Analysis section above). The findings should be referenced when creating a future optimization task. No changes to SKILL.md for this requirement.

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — add deployment action guidance section

### Testing

1. SKILL.md contains "DEPLOYMENT ACTION" section after DEPLOYMENT VERIFICATION
2. Three deployment options documented (TEST, PROD, Skip)
3. Symlink update command documented (`ln -sfn versions/vX.Y.Z viz/active`)
4. Service restart command documented (via thomas user SSH)
5. Verification curl documented
6. Credentials reference documented
7. AskUserQuestion used for deployment option selection
8. Performance reflection present in PDSA (not in SKILL.md — this is analysis, not implementation)
9. Refactoring opportunities identified (skill split, cache, lazy loading, template compression)
10. All v0.0.1-v0.0.4 changes preserved
11. All commits on develop branch
