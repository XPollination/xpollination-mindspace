# PDSA: Auto-Create Flag on Task Creation

**Task:** ms-a10-2-auto-flag
**Status:** Design
**Version:** v0.0.1

## Plan

On task creation, automatically generate a feature flag name and create a flag record with state=off.

### Dependencies

- **ms-a10-1-feature-flags-table** (complete): feature_flags table + CRUD
- **ms-a3-1-tasks-crud** (complete): Tasks table + POST endpoint

### Investigation

**DNA description:** On task creation: auto-generate flag name XPO_FEATURE_<TASK_ID> and create flag record with state=off.

**Existing code:**
- tasks.ts POST / creates task with optional feature_flag_name field
- feature_flags table: (id, project_slug, task_id, flag_name, state, ...)

**Design decisions:**
- Hook into existing POST / handler in tasks.ts
- Generate flag name: `XPO_FEATURE_` + first 8 chars of task UUID (uppercase, hyphens removed)
- Auto-create feature_flags record with state='off', linked to task_id
- Set task.feature_flag_name to the generated name
- If caller provides explicit feature_flag_name, use that instead of generating
- Flag creation is best-effort — task creation succeeds even if flag creation fails (log warning)

## Do

### File Changes

#### 1. `api/routes/tasks.ts` (UPDATE — extend POST / handler)

After task INSERT, add auto-flag creation:

```typescript
// After the INSERT INTO tasks:
const flagName = feature_flag_name || `XPO_FEATURE_${id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

try {
  const existingFlag = db.prepare(
    'SELECT id FROM feature_flags WHERE project_slug = ? AND flag_name = ?'
  ).get(slug, flagName);

  if (!existingFlag) {
    db.prepare(
      `INSERT INTO feature_flags (id, project_slug, task_id, flag_name, state, toggled_by, toggled_at)
       VALUES (?, ?, ?, ?, 'off', ?, datetime('now'))`
    ).run(randomUUID(), slug, id, flagName, user.id);
  }

  // Update task with the flag name
  db.prepare('UPDATE tasks SET feature_flag_name = ? WHERE id = ?').run(flagName, id);
} catch (e) {
  // Best-effort: log but don't fail task creation
  console.error('Auto-flag creation failed:', e);
}

const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
res.status(201).json(task);
```

## Study

### Test Cases (8 total)

**Auto-creation (3):**
1. Task creation auto-creates feature flag with state=off
2. Generated flag name follows XPO_FEATURE_<8chars> pattern
3. Task.feature_flag_name is set to the generated name

**Explicit flag name (2):**
4. Providing feature_flag_name uses that instead of generating
5. Explicit name still creates the flag record

**Idempotency (1):**
6. If flag with same name already exists, no duplicate created

**Failure handling (1):**
7. Task creation succeeds even if flag creation fails

**Enrichment (1):**
8. Created task response includes feature_flag_name

## Act

### Deployment

- 1 file: tasks.ts (UPDATE — extend POST handler)
- No migration needed — uses existing feature_flags table
- Backward compatible — existing behavior preserved when feature_flag_name provided
