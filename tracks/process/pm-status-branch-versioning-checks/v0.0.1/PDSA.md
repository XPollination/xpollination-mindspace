# PDSA: PM Status Skill — Branch Compliance, Versioning, and Ref Validation

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The PM status skill (`xpo.claude.mindspace.pm.status/SKILL.md`) currently relies on LIAISON to manually remember branch compliance checks, versioning validation, and ref URL validation during task drill-down. This is error-prone — the t1-1-tsdoc-config rework proved that LIAISON missed a branch violation and a wrong pdsa_ref URL in the initial approval, only catching them on second review. These checks must be codified in the skill template so any LIAISON on any environment performs them automatically.

## Analysis

The skill's Phase 2 drill-down (Step 3) presents each actionable task with a structured format. Three verification steps need to be added between DNA retrieval (step 2) and presentation (step 3):

1. **Branch compliance** — commits should be on develop or feature/* branches, not main
2. **Versioning validation** — tracks/ artifacts should follow semver pattern with required files
3. **Ref URL validation** — pdsa_ref, changelog_ref should point to correct repo and branch

These checks use `git branch --contains`, filesystem inspection, and URL pattern matching — all available to LIAISON via Bash and Read tools already allowed by the skill.

Current skill structure (Step 3):
- Check LIAISON approval mode
- Get full DNA
- Present structured format with breadcrumb
- Execute transition

The three new checks insert between "Get full DNA" and "Present structured format."

## Design

### Change A: Add verification checks to SKILL.md Step 3

Insert between current steps 2 (Get full DNA) and 3 (Present to Thomas) in Step 3:

```markdown
2b. **Run automated verification checks** (after getting DNA, before presenting):

   **BRANCH COMPLIANCE** (for tasks with commits in DNA):
   Extract commit hashes from `implementation`, `changelog_ref`, or other DNA fields mentioning commits (pattern: `[0-9a-f]{7,40}`).
   For each commit hash found:
   ```bash
   git -C <project-repo-path> branch --contains <hash> 2>/dev/null
   ```
   - If output contains only `main` (no develop or feature/*): **VIOLATION**
   - If output contains `develop` or `feature/*`: **OK**
   - If no commits found in DNA: **N/A**

   **VERSIONING** (for tasks with tracks/ artifacts):
   ```bash
   ls -d <project-repo-path>/tracks/process/<slug>/v*/ 2>/dev/null
   ```
   For each version directory found:
   - Verify directory name matches `v[0-9]+.[0-9]+.[0-9]+` pattern
   - Check for PDSA.md or changelog.md presence inside
   - If rework_count > 0: verify latest version > v0.0.1

   **REF VALIDATION** (for pdsa_ref, changelog_ref, abstract_ref):
   For each `*_ref` URL in DNA:
   - Extract repo name from GitHub URL (e.g., `PichlerThomas/xpollination-mcp-server`)
   - Extract branch from URL (e.g., `blob/develop/...`)
   - Compare repo in URL vs actual project where task lives
   - Flag mismatch: wrong repo, wrong org, or main branch when develop expected

   Add results to the drill-down presentation as headers after the breadcrumb:

   ```
   === Task N of M: <title> ===
   DESIGN QUEUE > DESIGNING > >>>APPROVAL<<< > ...

   BRANCH COMPLIANCE: OK | VIOLATION (commit abc1234 only on main) | N/A
   VERSIONING: OK (v0.0.2, PDSA.md present) | WARN (no changelog.md) | N/A
   REF VALIDATION: OK | WARN (pdsa_ref points to wrong repo) | N/A

   MANAGEMENT ABSTRACT
   ...
   ```

   **If any check shows VIOLATION or WARN:** Include in RECOMMENDATION section with specific fix needed. LIAISON should recommend REWORK for VIOLATION, use judgment for WARN.
```

### Change B: Implementation location

Modify `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`:
- Insert the verification block as step 2b in Step 3
- Add the three status headers to the presentation template (after breadcrumb line)
- Update the good example to show the headers
- Add a note about git path resolution: use the project path from the pm-status scan output

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — add verification checks to Step 3

### Testing

1. SKILL.md contains "BRANCH COMPLIANCE" check instructions
2. SKILL.md contains "VERSIONING" check instructions
3. SKILL.md contains "REF VALIDATION" check instructions
4. All three headers appear in the presentation template after breadcrumb
5. Good example includes the three headers
6. VIOLATION/WARN findings are routed to RECOMMENDATION section
7. Existing skill structure (approval mode check, DNA retrieval, transition execution) is unchanged
