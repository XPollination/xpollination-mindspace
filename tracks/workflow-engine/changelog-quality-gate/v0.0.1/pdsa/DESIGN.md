# PDSA: Changelog Quality Gate — v0.0.1

## PLAN

### Problem

Tasks can be completed without documenting what changed. There is no enforcement for a changelog delivery artifact. Thomas wants every completed task to have a human-readable changelog linked in DNA, so he can click through to it from the viz.

### Current State

- **Viz changelogs:** `viz/versions/v0.0.N/changelog.json` — machine-readable, used by the update notification system. These are viz-specific.
- **Track structure:** `tracks/<domain>/<slug>/v0.0.N/pdsa/DESIGN.md` — only contains PDSA design docs. No changelog artifact.
- **DNA:** No `changelog_ref` field exists. No gate checks for it.

### Design

#### 1. Changelog Delivery Artifact

Each version directory gets a `changelog.md` at the root level:

```
tracks/<domain>/<slug>/v0.0.N/changelog.md
```

Format (human-readable markdown):

```markdown
# Changelog: <task-title> — v0.0.N

## Changes
- <What changed, in plain language>
- <What changed>

## Date
YYYY-MM-DD
```

This is a simple, human-readable file. Not JSON. Not auto-generated. Written by the agent completing the work as part of the delivery.

#### 2. DNA Field: `changelog_ref`

Add `changelog_ref` to DNA — a git link to the changelog file:

```
https://github.com/XPollination/xpollination-mcp-server/blob/main/tracks/<domain>/<slug>/v0.0.N/changelog.md
```

Set by the completing agent (typically DEV or PDSA) before transitioning to review.

#### 3. Quality Gate in interface-cli.js

Add a gate that fires on `review->complete` (the final transition by liaison):

```javascript
// Changelog quality gate: fires on review→complete for tasks with pdsa_ref
// (design tasks always have a version directory — changelog belongs there)
if (fromStatus === 'review' && newStatus === 'complete' && dna.pdsa_ref) {
  if (!dna.changelog_ref) {
    db.close();
    error('Changelog gate: changelog_ref required in DNA before completing. Every versioned task must have a changelog.md in its version directory. Add changelog_ref with a git link to the file.');
  }
}
```

**Scope:** Only applies to tasks with `pdsa_ref` (design tasks that have version directories). Bug fixes and ad-hoc tasks without version directories are exempt.

**Lazy refactoring:** The gate checks `dna.changelog_ref` on the DNA, not the filesystem. Existing completed tasks are unaffected. Only tasks transitioning to complete after gate deployment need the field. No retroactive enforcement.

#### 4. Viz Detail Panel: Show changelog_ref

In the viz detail panel (`showDetail()` function), add `changelog_ref` as a clickable link when present:

```javascript
// After existing DNA fields in detail panel:
if (dna.changelog_ref) {
  html += `<div class="detail-field">
    <label>Changelog</label>
    <div class="value"><a href="${escapeHtml(dna.changelog_ref)}" target="_blank" style="color:#e94560;">View Changelog</a></div>
  </div>`;
}
```

### Changes Required

1. **`src/db/interface-cli.js`** (~8 lines):
   - Add changelog quality gate after the version enforcement gate (after line 513)
   - Fires on `review->complete` when `dna.pdsa_ref` exists
   - Rejects if `dna.changelog_ref` is missing

2. **`viz/index.html`** (~6 lines):
   - Add `changelog_ref` display in `showDetail()` function
   - Clickable link with target="_blank"
   - Also update versioned copy

3. **Process documentation** (not code — protocol update):
   - DEV/PDSA agents must create `changelog.md` in version directory before review
   - DEV/PDSA agents must set `dna.changelog_ref` before submitting for review

### What This Does NOT Do

- Does NOT retroactively require changelogs on already-complete tasks
- Does NOT auto-generate changelogs (human/agent writes them)
- Does NOT affect bug-type tasks or tasks without pdsa_ref
- Does NOT replace viz changelog.json (that's for the update notification system)
- Does NOT validate that the file actually exists at the git URL (trust but verify)

### Acceptance Criteria

1. `review->complete` transition rejected without `changelog_ref` for design tasks (has pdsa_ref)
2. Clear error message tells agent what to do
3. Tasks without `pdsa_ref` (bugs, ad-hoc) can still complete without changelog
4. Viz detail panel shows changelog_ref as clickable "View Changelog" link
5. Gate is forward-looking only (lazy refactoring)

## DO

Implementation by DEV agent. ~8 lines in interface-cli.js, ~6 lines in viz index.html.

## STUDY

After implementation:
- Try to complete a design task without changelog_ref — verify rejection
- Add changelog_ref to DNA — verify completion succeeds
- Verify viz detail panel shows the link

## ACT

If approved: all future task completions must include changelog.md. Update DEV and PDSA agent protocols to include changelog creation as part of the delivery workflow.
