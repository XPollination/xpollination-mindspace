# PDSA: PM Status Skill — Branch Compliance, Versioning, Ref Validation + Visual Hierarchy

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.2
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.1 implemented three verification checks correctly but had two issues:
1. Implementation commits landed on main instead of develop (branch violation)
2. Thomas's feedback: task slug and pipeline phase lack visual emphasis — hard to scan in 3 seconds

## Analysis

Thomas scans the drill-down top-to-bottom in ~3 seconds, needing: (1) WHICH task (slug), (2) WHAT phase (approval vs review), (3) any violations. The verification headers (#3) already use bold+color effectively. But the slug is buried in the title line at same weight, and the pipeline phase uses text-based `>>>PHASE<<<` arrows that don't stand out.

The skill template outputs markdown — LIAISON renders it. Bold (`**`), caps, and structural separation are the main formatting tools available.

## Design

### Change A: Rework branch compliance (process fix)

DEV and QA must commit to develop, not main. This applies to both:
- Implementation commit (currently ae63cc5 on best-practices main)
- Test commit (currently 5c7d5df on mcp-server main)

### Change B: Visual hierarchy for slug and phase

Restructure the Step 3 presentation header block. Current:

```
=== Task N of M: <title> ===
DESIGN QUEUE > DESIGNING > >>>APPROVAL<<< > ...
```

New:

```
=== Task N of M ===
**SLUG:** `<slug>` | **PROJECT:** <project>
**PHASE:** >>>APPROVAL<<< ← YOU ARE HERE
DESIGN QUEUE > DESIGNING > **APPROVAL** > TESTING > IMPLEMENTING > QA REVIEW > PDSA REVIEW > HUMAN REVIEW > COMPLETE
**TITLE:** <title>
Type: <type> | Priority: <priority>
Status: <status+role> → Action: Approve/Complete or Rework?
```

Key changes:
- **Slug on its own line** with bold label and backtick formatting — instantly findable
- **Phase called out separately** above the breadcrumb with `← YOU ARE HERE` marker
- **Current phase bolded** in the breadcrumb (instead of `>>><<<` arrows which are noisy)
- **Title moved below** phase info — it's context, not the primary identifier
- Breadcrumb stays for reference but the phase callout above it is the scan target

### Change C: Update good example in SKILL.md

Update the good example to match the new header structure.

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — restructured header block in Step 3
2. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — updated good example

### Testing

1. Slug appears on its own labeled line (`**SLUG:** \`<slug>\``)
2. Phase has separate callout line with `← YOU ARE HERE`
3. Current phase is bolded in breadcrumb (not `>>><<<`)
4. Good example matches new structure
5. All v0.0.1 verification checks preserved (branch, versioning, ref)
6. All commits on develop branch
7. Thomas 3-second scan test: slug, phase, and violations should be identifiable without re-reading
