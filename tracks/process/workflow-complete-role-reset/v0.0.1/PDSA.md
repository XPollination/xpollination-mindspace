# PDSA: Workflow engine — set role to liaison on complete transition

**Task:** workflow-complete-role-reset
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

When tasks transition to `complete`, the `role` field in DNA is not consistently set to `liaison`. Per WORKFLOW.md v16 line 24: `complete | human | liaison` — the monitor for complete status is `liaison`. Currently 69 of 145 complete tasks have wrong roles (10 qa, 6 dev, 12 pdsa, 41 null).

### Root Cause

The `review->complete` and `approval->complete` rules in `workflow-engine.js` already have `newRole: 'liaison'`, so tasks completing through the standard CLI transition path DO get the correct role. The 69 broken tasks were likely completed through:
- Earlier versions of the engine before `newRole` was added to complete rules
- Direct database updates (bypassing the engine)
- Edge cases where the role was already `liaison` and the engine skipped the DNA write (harmless but still leaves null roles from old data)

### Why a Safety Net

Even though current rules are correct, a catch-all safety net in `cmdTransition` ensures that ANY future transition to `complete` — regardless of whether the rule defines `newRole` — will always set `role: 'liaison'`. This is a "if the system does not PREVENT it, it WILL happen" principle (workflow-engine.js line 4).

## Analysis

### Options considered

1. **Safety net in cmdTransition + cleanup migration** — After computing `newRole` from rules, if `newStatus === 'complete'`, force `newRole = 'liaison'`. Plus a one-time SQL cleanup. Bump workflow version to v17.
   - Pros: Defense-in-depth, prevents future regression, fixes historical data, minimal code change
   - Cons: None significant

2. **Only fix rules, no safety net** — The rules are already correct. Only add the cleanup query.
   - Pros: Even simpler
   - Cons: No protection against future omissions; "if the system does not PREVENT it, it WILL happen"

**Decision: Option 1.** The safety net is 3 lines of code and prevents an entire class of bugs permanently.

## Design

### Change A: Safety net in interface-cli.js cmdTransition

In `interface-cli.js`, after line 666 (after the `complete->rework` role override), add:

```javascript
// Safety net: complete status ALWAYS has role=liaison (WORKFLOW.md line 24)
if (newStatus === 'complete') {
  newRole = 'liaison';
}
```

**Location:** Between the rework_target_role handling (line 660-666) and the `updatedDna` assignment (line 668). This ensures the safety net runs AFTER all rule lookups but BEFORE the DNA is written.

### Change B: Cleanup migration script

Create `src/db/migrations/v17-complete-role-reset.js`:

```javascript
// One-time migration: fix role on all complete tasks
// Run via: DATABASE_PATH=... node src/db/migrations/v17-complete-role-reset.js

import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH;
if (!dbPath) { console.error('DATABASE_PATH required'); process.exit(1); }

const db = new Database(dbPath);
const rows = db.prepare(`
  SELECT id, slug, dna_json FROM mindspace_nodes
  WHERE status = 'complete'
`).all();

let fixed = 0;
for (const row of rows) {
  const dna = JSON.parse(row.dna_json);
  if (dna.role !== 'liaison') {
    dna.role = 'liaison';
    db.prepare(`
      UPDATE mindspace_nodes SET dna_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(dna), row.id);
    fixed++;
  }
}

console.log(`Fixed ${fixed} of ${rows.length} complete tasks (set role=liaison)`);
db.close();
```

Run against ALL project databases:
- `xpollination-mcp-server/data/xpollination.db`
- `HomePage/data/xpollination.db`
- `xpollination-best-practices/data/xpollination.db`

### Change C: Workflow version bump v16 → v17

Create `tracks/process/context/workflow/v17/WORKFLOW.md` by copying v16 and appending:

In the changelog table, add row:
```
| 2026-03-09 | v17 Safety net: engine forces role=liaison on ANY transition to complete. One-time migration fixes 69 historical complete tasks with wrong roles. Codifies WORKFLOW.md line 24 rule in code | PDSA |
```

Update the version header from v16 to v17.

### Change D: Update CLAUDE.md workflow reference

In the PROD CLAUDE.md, update any reference to workflow version:
- `docs/WORKFLOW.md` or `tracks/process/context/workflow/v16` → `v17`

### Files Changed

1. `xpollination-mcp-server/src/db/interface-cli.js` — 3-line safety net after line 666
2. `xpollination-mcp-server/src/db/migrations/v17-complete-role-reset.js` — new cleanup script
3. `xpollination-mcp-server/tracks/process/context/workflow/v17/WORKFLOW.md` — version bump + changelog
4. `xpollination-mcp-server/CLAUDE.md` — workflow version reference update (if present)

### Testing

1. `getNewRoleForTransition('task', 'review', 'complete', 'liaison')` returns `'liaison'` (already works)
2. A task with role=qa transitioning to complete gets role=liaison in DNA after transition
3. A task with role=pdsa transitioning to complete gets role=liaison in DNA after transition
4. A task with role=null transitioning to complete gets role=liaison in DNA after transition
5. The safety net code exists in interface-cli.js (grep for "Safety net: complete status")
6. The safety net runs AFTER rule lookup but BEFORE DNA write
7. Migration script exists at `src/db/migrations/v17-complete-role-reset.js`
8. Migration script only updates complete tasks where role !== 'liaison'
9. Migration script uses DATABASE_PATH env var
10. After running migration, all complete tasks have role='liaison'
11. WORKFLOW.md v17 exists with changelog entry
12. v17 changelog mentions safety net + migration + "69 historical"
13. Normal workflow transitions (non-complete) are NOT affected by safety net
14. `approval->complete` also gets role=liaison (already works, safety net confirms)
