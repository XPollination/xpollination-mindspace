# PDSA: Enforce depends_on as scheduling gate

**Task:** enforce-depends-on-engine
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-06

## Problem

The `depends_on` field in task DNA is decorative — the engine ignores it. Any task can transition to `ready` regardless of dependency state. With 89+ tasks pending parallel execution, this creates unmanageable race conditions.

## Design

### Change A: Dependency-aware scheduling gate (interface-cli.js)

Add a check in `cmdTransition()` before `pending→ready`:

```javascript
// Dependency gate: pending→ready requires all depends_on tasks to be complete
if (fromStatus === 'pending' && newStatus === 'ready') {
  const deps = dna.depends_on || [];
  if (deps.length > 0) {
    const incomplete = [];
    for (const depSlug of deps) {
      const dep = db.prepare('SELECT slug, status FROM mindspace_nodes WHERE slug = ?').get(depSlug);
      if (!dep) {
        incomplete.push(`${depSlug} (not found)`);
      } else if (dep.status !== 'complete') {
        incomplete.push(`${depSlug} (status: ${dep.status})`);
      }
    }
    if (incomplete.length > 0) {
      db.close();
      error(`Dependency gate: cannot transition to ready. Incomplete dependencies: ${incomplete.join(', ')}`);
    }
  }
}
```

**Location:** In `cmdTransition()`, after DNA is loaded but before the transition executes. Place it near the existing quality gates (after line ~570, before the LIAISON approval mode gate).

**Scope:** Only blocks `pending→ready`. Other transitions (e.g., `ready→active`) are not affected — once a task is `ready`, its dependencies are already satisfied.

### Change B: Dependency reflection gate (interface-cli.js)

When `depends_on` is empty/missing AND `depends_on_reviewed` is not set, block `pending→ready`:

```javascript
// Dependency reflection gate: must either have dependencies or explicitly confirm none needed
if (fromStatus === 'pending' && newStatus === 'ready') {
  const deps = dna.depends_on || [];
  if (deps.length === 0 && !dna.depends_on_reviewed) {
    db.close();
    error('Dependency reflection gate: task has no dependencies. Set depends_on[] with dependency slugs, or set depends_on_reviewed=true to confirm no dependencies needed.');
  }
}
```

**Opt-out pattern:** Setting `depends_on_reviewed: true` is the explicit "I thought about it, no deps needed" signal. This prevents accidental omission.

### Change C: Migration strategy for existing tasks

89+ pending tasks currently have no `depends_on_reviewed` flag. Options:
1. **Bulk set** `depends_on_reviewed: true` for all existing pending tasks (treats them as grandfathered)
2. **Gate only new tasks** created after this change
3. **LIAISON reviews** each pending task's dependencies before activating

**Recommendation:** Option 1 — bulk set for existing tasks. The 89 tasks were already created with dependency consideration by LIAISON. New tasks created after this change will be subject to the reflection gate.

The bulk update SQL:
```sql
UPDATE mindspace_nodes
SET dna_json = json_set(dna_json, '$.depends_on_reviewed', json('true'))
WHERE status = 'pending' AND type = 'task'
AND json_extract(dna_json, '$.depends_on') IS NULL
OR json_array_length(json_extract(dna_json, '$.depends_on')) = 0;
```

### Change D: workflow-engine.js update

No changes needed to `ALLOWED_TRANSITIONS`. The dependency gate is a data-level check in `cmdTransition()`, not a transition rule change. The engine's `requiresDna` mechanism doesn't support dynamic cross-task lookups.

### Files Changed

1. `src/db/interface-cli.js` — two new gates in `cmdTransition()` for `pending→ready`
2. Migration script or one-time SQL for existing pending tasks

### Testing

1. Task with `depends_on: ['incomplete-slug']` → `pending→ready` REJECTED with error listing incomplete dep
2. Task with `depends_on: ['complete-slug']` → `pending→ready` ALLOWED
3. Task with `depends_on: ['nonexistent-slug']` → `pending→ready` REJECTED with "not found"
4. Task with `depends_on: []` and no `depends_on_reviewed` → `pending→ready` REJECTED
5. Task with `depends_on: []` and `depends_on_reviewed: true` → `pending→ready` ALLOWED
6. Task with no `depends_on` field and no `depends_on_reviewed` → `pending→ready` REJECTED
7. Task with `depends_on: ['complete-a', 'incomplete-b']` → REJECTED (lists only incomplete-b)
8. Non-pending→ready transitions unaffected (e.g., `rework→ready` should not check depends_on)
