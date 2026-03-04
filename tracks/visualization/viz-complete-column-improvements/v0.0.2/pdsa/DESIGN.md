# PDSA: Viz Complete Column Improvements — v0.0.2

## REWORK CONTEXT

> **Thomas feedback (liaison_rework_reason):**
> "i already see the changes after my latest refresh. that is not good. the old symlink must stay active until i say complete. systemical problem."

DEV modified v0.0.4 in-place while the active symlink pointed to it. Thomas saw unapproved changes after browser refresh. This is a process problem that applies to ALL future viz changes.

## PLAN

### Problem Analysis

v0.0.4 accumulated 5 commits while active:
1. `b809fff` — Light mode CSS (original v0.0.4, Thomas-approved)
2. `15a5fd1` — changelog_ref in detail panel (changelog-quality-gate task)
3. `9c1b5df` — Light mode fix for liaison selector (viz-light-mode-incomplete bug)
4. `ee823c3` — Parent/child slug lookup fix (viz-parent-ids-not-in-details bug)
5. `6dddcc9` — Complete column improvements (this task)

Commits 2-5 were added to the active version — Thomas sees them before approval.

### Root Cause

No process rule prevents DEV from modifying the version directory that the active symlink points to. DEV was told "update v0.0.4" but should have created v0.0.5.

### Design

Two parts: (A) immediate fix for this task, (B) systemic process rule.

#### Part A: Immediate Fix

1. **Create v0.0.5** by copying current v0.0.4 (which has all accumulated changes including complete-column-improvements)
2. **Revert v0.0.4/index.html** to its Thomas-approved state — commit `b809fff` (light mode CSS only)
3. **Active symlink stays on v0.0.4** (now clean, Thomas-approved)
4. Review chain runs against v0.0.5
5. Thomas approves via `complete` → symlink moves to v0.0.5

```bash
# DEV executes:
cp -r viz/versions/v0.0.4 viz/versions/v0.0.5
git checkout b809fff -- viz/versions/v0.0.4/index.html
# Active symlink stays on v0.0.4 (unchanged)
```

**Note:** Commits 2-4 (changelog_ref, light mode fix, parent-ids fix) will also be in v0.0.5 but not in the reverted v0.0.4. This is acceptable — those tasks are still in the review chain and will be included when v0.0.5 is activated. Thomas won't see those changes until he approves v0.0.5.

#### Part B: Version Deployment Process Rule

**Rule: DEV NEVER modifies the active version directory.**

Process for all future viz changes:

1. **DEV** determines the next version number: `N+1` where `N` is the latest existing version
2. **DEV** copies the active version to create the new directory:
   ```bash
   cp -r viz/versions/v0.0.N viz/versions/v0.0.N+1
   ```
3. **DEV** makes all changes in `v0.0.N+1/` only
4. **DEV** creates `v0.0.N+1/changelog.json` with change description
5. **DEV** commits and pushes — active symlink is NOT touched
6. **Review chain** runs (QA, PDSA, LIAISON) — Thomas does NOT see changes
7. **On `complete` transition**: LIAISON updates the active symlink:
   ```bash
   ln -sfn versions/v0.0.N+1 viz/active
   ```
8. Thomas refreshes browser → sees changes + changelog popup

**Who moves the symlink?** LIAISON agent, as the final step after Thomas says "complete". This is a manual step in the completion transition, not automated in the gate (to keep it simple and visible).

**What about the changelog popup?** The existing update notification system detects version change on browser refresh. No change needed — the popup already works when the symlink moves.

### Changes Required (v0.0.2)

1. **`viz/versions/v0.0.5/`** (CREATE):
   - Copy of current v0.0.4 (with all accumulated changes)
   - Includes: complete column sort, time filter, timestamps, changelog_ref, light mode fix, parent-ids fix

2. **`viz/versions/v0.0.4/index.html`** (REVERT):
   - Restore to commit b809fff (Thomas-approved light mode only)

3. **`viz/versions/v0.0.5/changelog.json`** (CREATE):
   - Document all changes since v0.0.4 (commits 2-5)

4. **Active symlink** (NO CHANGE):
   - Stays on v0.0.4 until Thomas completes

### What This Does NOT Do

- Does NOT change the complete-column-improvements code (already implemented correctly in v0.0.1)
- Does NOT add automated symlink swapping in transition gates (keep it simple)
- Does NOT retroactively version commits 2-4 separately (they're batched into v0.0.5)
- Does NOT add a new quality gate (this is a process rule, not code enforcement)

### Acceptance Criteria (v0.0.2)

1. v0.0.5 directory exists with all accumulated changes
2. v0.0.4/index.html reverted to Thomas-approved state (commit b809fff)
3. Active symlink still points to v0.0.4 after DEV work
4. Thomas does NOT see new changes on browser refresh (until complete)
5. After complete: LIAISON moves symlink to v0.0.5, Thomas sees changes

## DO

Implementation by DEV agent. Copy v0.0.4 to v0.0.5, revert v0.0.4, create changelog.json.

## STUDY

- Verify Thomas cannot see complete-column-improvements after DEV work
- Verify Thomas sees them after LIAISON moves symlink
- Verify changelog popup appears on version change

## ACT

If approved: this version deployment process applies to ALL future viz changes. DEV must ALWAYS create a new version directory. Document in CLAUDE.md or dev workflow docs.
