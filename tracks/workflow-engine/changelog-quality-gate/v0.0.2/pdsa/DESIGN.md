# PDSA: Changelog Quality Gate — v0.0.2

## REWORK CONTEXT

> **Thomas feedback (liaison_rework_reason):**
> "changelog.md must be in the corresponding version directory. ensure that is understood and i need to add it then in the management abstract"

v0.0.1 design was correct about the location but Thomas wants two clarifications:
1. Make absolutely clear that changelog.md lives IN the version directory
2. Add the changelog_ref link to the management abstract in PM status presentation

## PLAN

### Changes from v0.0.1

v0.0.1 design is carried forward with two additions:

#### Addition 1: Emphasize Changelog Location

The changelog.md goes in the **version directory root** — same level as the `pdsa/` folder:

```
tracks/<domain>/<slug>/v0.0.N/
  ├── changelog.md          ← HERE (version root)
  └── pdsa/
      └── DESIGN.md
```

NOT in `pdsa/`, NOT elsewhere. Every version directory gets its own changelog.md describing what changed in that version.

Example path:
```
tracks/workflow-engine/changelog-quality-gate/v0.0.1/changelog.md
```

#### Addition 2: Changelog in PM Status Management Abstract

Update the PM status skill (`xpo.claude.mindspace.pm.status/SKILL.md`) to include `changelog_ref` in the management abstract when available.

In the presentation template (Step 3, item 3), add to WHAT WAS DONE section:

```
WHAT WAS DONE
- <Key implementation/design points>
- <Commits or deliverables if available>
- Changelog: [View](changelog_ref_link)    ← NEW: when dna.changelog_ref exists
```

This gives Thomas a clickable link directly in the PM status drill-down, not just in the viz detail panel.

### All Changes Required (v0.0.1 + v0.0.2 additions)

1. **`src/db/interface-cli.js`** (~8 lines):
   - Add changelog quality gate after version enforcement gate
   - Fires on `review->complete` when `dna.pdsa_ref` exists
   - Rejects if `dna.changelog_ref` is missing
   - Error message explicitly states: "Every versioned task must have a changelog.md in its version directory (tracks/<domain>/<slug>/v0.0.N/changelog.md)"

2. **`viz/index.html`** (~6 lines):
   - Add `changelog_ref` display in `showDetail()` function
   - Clickable link with target="_blank"
   - Also update versioned copy

3. **`xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`** (~2 lines):
   - In WHAT WAS DONE section template: add changelog_ref as clickable link when present in DNA

### What This Does NOT Do

- Does NOT retroactively require changelogs on already-complete tasks
- Does NOT auto-generate changelogs
- Does NOT affect bug-type tasks or tasks without pdsa_ref
- Does NOT replace viz changelog.json

### Acceptance Criteria (v0.0.2)

1. `review->complete` rejected without `changelog_ref` for design tasks
2. Error message explicitly mentions version directory path
3. Viz detail panel shows changelog_ref as clickable link
4. PM status management abstract includes changelog_ref when present
5. Tasks without pdsa_ref can still complete without changelog

## DO

Implementation by DEV agent. ~8 lines CLI + ~6 lines viz + ~2 lines skill.

## STUDY

- Try completing a design task without changelog_ref — verify rejection
- Verify viz detail panel shows the link
- Run PM status — verify changelog appears in WHAT WAS DONE

## ACT

If approved: all future task completions must include changelog.md in the version directory.
