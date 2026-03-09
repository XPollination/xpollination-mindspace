# PDSA: PM Status Skill — Markdown Style Guide, HUMAN APPROVAL Rename, AskUserQuestion for SEMI Mode

**Task:** pm-status-branch-versioning-checks
**Version:** v0.0.3
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

v0.0.2 was approved (visual hierarchy + branch fix) but 3 additional requirements were added by Thomas:

1. No markdown rendering style guide exists — new agents reading only the skill cannot reproduce the same formatting quality seen in manual LIAISON output.
2. The breadcrumb uses "APPROVAL" which is ambiguous — it could be automated approval. Thomas wants "HUMAN APPROVAL" to clearly indicate a human decision gate.
3. SEMI mode still says "Do NOT use AskUserQuestion" (ban from 2026-03-02 bug). The bug is resolved (tested 2026-03-09). Thomas wants AskUserQuestion with selectable options for cleaner UX.

## Analysis

The SKILL.md is the single source of truth for how LIAISON presents PM status. All three issues are localized changes:

- **Style guide**: No formatting guidance currently exists. The good example implicitly demonstrates formatting but doesn't codify rules. A new agent may produce raw field dumps (the "bad example") simply because rules aren't stated.
- **HUMAN APPROVAL rename**: Appears in two places — the breadcrumb line (line 155) and the status-to-phase mapping table (line 147). Also in the good example breadcrumb (line 205).
- **AskUserQuestion**: The SEMI mode block (line 254) explicitly bans AskUserQuestion. This needs to be reversed — use AskUserQuestion with options [Approve, Rework, Complete] so Thomas can select with arrow keys.

## Design

### Change C: Markdown Rendering Style Guide (new section)

Add a **Rendering Style Guide** subsection inside Step 3, after the "Rules" block (line 199) and before the "Good example" (line 202). This codifies what was previously implicit:

```markdown
   **Rendering Style Guide** (all drill-down output must follow these rules):

   - **Header labels** use bold: `**BRANCH COMPLIANCE:**`, `**MANAGEMENT ABSTRACT**`, `**RECOMMENDATION**`
   - **Status indicators** use bold: `**OK**`, `**VIOLATION**`, `**WARN**`, `**PASS**`, `**FAIL**`, `**N/A**`
   - **Technical identifiers** use backticks: commit hashes (`abc1234`), slugs (`task-slug`), branches (`develop`), file paths (`tracks/process/...`), field names (`pdsa_ref`)
   - **Evaluative tone in RECOMMENDATION**: Write a conversational rationale, not just a verdict. Include WHY you recommend approve/rework, referencing specific evidence from the review chain or verification checks.
   - **Section headers**: ALL CAPS without markdown formatting (e.g., `MANAGEMENT ABSTRACT`, not `**MANAGEMENT ABSTRACT**` or `### MANAGEMENT ABSTRACT`). The caps provide visual weight; additional formatting is noise.

   Exception: Section headers inside the `=== ... ===` block use ALL CAPS only. The bold formatting rule applies to inline labels and status indicators within content.
```

### Change D: Rename APPROVAL → HUMAN APPROVAL

Three locations in SKILL.md:

1. **Status-to-phase mapping table** (line 147): Change `| approval | APPROVAL |` to `| approval | HUMAN APPROVAL |`
2. **Breadcrumb line** (line 155): Change `APPROVAL` to `HUMAN APPROVAL` in the full breadcrumb
3. **Good example breadcrumb** (line 205): Same rename
4. **Good example** and any other breadcrumb references throughout

### Change E: AskUserQuestion for SEMI Mode

Replace the SEMI mode block (lines 253-254) with:

```markdown
   **SEMI mode:** Present the task details, then ask Thomas for his decision using AskUserQuestion with selectable options:
   - Options: ["Approve", "Rework", "Complete"]
   - Include a brief context line: "Task: <slug> (<project>) — <recommendation>"
   - Thomas selects with arrow keys + Enter.
   - Execute the corresponding transition based on his selection.
   - If Thomas provides text feedback instead of selecting an option, treat it as rework guidance — add to DNA as `rework_feedback` and transition to rework.
```

Remove the line "Do NOT use AskUserQuestion — it produces false positives (documented 2026-03-02)."

### Files Changed

1. `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` — all 3 changes

### Testing

1. SKILL.md contains "Rendering Style Guide" subsection with all 5 formatting rules
2. Bold rule for header labels documented
3. Bold rule for status indicators documented
4. Backtick rule for technical identifiers documented
5. Evaluative tone rule for RECOMMENDATION documented
6. Section header exception (ALL CAPS only) documented
7. Breadcrumb uses `HUMAN APPROVAL` (not `APPROVAL`)
8. Status-to-phase table maps `approval` → `HUMAN APPROVAL`
9. Good example breadcrumb uses `HUMAN APPROVAL`
10. SEMI mode instructions reference `AskUserQuestion`
11. SEMI mode provides selectable options [Approve, Rework, Complete]
12. Old AskUserQuestion ban ("Do NOT use AskUserQuestion") is removed
13. Text feedback fallback documented for SEMI mode
14. All v0.0.1 verification checks preserved (branch, versioning, ref)
15. All v0.0.2 visual hierarchy changes preserved (slug line, phase callout, bolded breadcrumb)
16. All commits on develop branch
