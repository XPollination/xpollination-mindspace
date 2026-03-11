# PDSA: Task List with Filters

**Task:** ms-a3-8-task-filters
**Status:** Design
**Version:** v0.0.1

## Plan

Enhance the existing GET /api/projects/:slug/tasks endpoint with additional filter parameters: claimed/unclaimed, blocked/unblocked, and available_only (unclaimed + unblocked + ready).

### Dependencies

- **ms-a3-1-tasks-crud** (complete): Tasks table with GET endpoint (status, current_role filters)
- **ms-a8-1-dependency-table** (complete): task_dependencies table

### Investigation

**Existing endpoint (tasks.ts lines 53-73):**
Already supports `?status=` and `?current_role=` query params. Needs extension for:
- `?claimed=true/false` — filter by claimed/unclaimed
- `?blocked=true/false` — filter by whether task has incomplete dependencies
- `?available_only=true` — shorthand for: status=ready AND unclaimed AND unblocked

**DNA description:** GET /api/projects/:slug/tasks with filter params: status, role, claimed/unclaimed, blocked/unblocked. Returns enriched task list.

**Design decisions:**
- Extend existing GET handler in tasks.ts, no new file needed
- `claimed` filter: WHERE claimed_by IS NULL (unclaimed) or IS NOT NULL (claimed)
- `blocked` filter: uses LEFT JOIN on task_dependencies to check for incomplete blockers
- `available_only` combines: status='ready' AND claimed_by IS NULL AND no incomplete deps
- Enrich response with `is_blocked` boolean and `blocker_count` integer per task

## Do

### File Changes

#### 1. `api/routes/tasks.ts` (UPDATE — replace GET / handler)

```typescript
// GET / — list tasks for project with filters
tasksRouter.get('/', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { status, current_role, claimed, blocked, available_only } = req.query;
  const db = getDb();

  // available_only is a shorthand: ready + unclaimed + unblocked
  if (available_only === 'true') {
    const tasks = db.prepare(
      `SELECT t.*, COALESCE(bc.blocker_count, 0) as blocker_count,
              CASE WHEN COALESCE(bc.blocker_count, 0) > 0 THEN 1 ELSE 0 END as is_blocked
       FROM tasks t
       LEFT JOIN (
         SELECT td.task_id, COUNT(*) as blocker_count
         FROM task_dependencies td
         JOIN tasks bt ON bt.id = td.blocked_by_task_id AND bt.status != 'complete'
         GROUP BY td.task_id
       ) bc ON bc.task_id = t.id
       WHERE t.project_slug = ? AND t.status = 'ready' AND t.claimed_by IS NULL
         AND COALESCE(bc.blocker_count, 0) = 0
       ORDER BY t.created_at DESC`
    ).all(slug);
    res.status(200).json(tasks);
    return;
  }

  let sql = `SELECT t.*, COALESCE(bc.blocker_count, 0) as blocker_count,
             CASE WHEN COALESCE(bc.blocker_count, 0) > 0 THEN 1 ELSE 0 END as is_blocked
             FROM tasks t
             LEFT JOIN (
               SELECT td.task_id, COUNT(*) as blocker_count
               FROM task_dependencies td
               JOIN tasks bt ON bt.id = td.blocked_by_task_id AND bt.status != 'complete'
               GROUP BY td.task_id
             ) bc ON bc.task_id = t.id
             WHERE t.project_slug = ?`;
  const params: any[] = [slug];

  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (current_role) { sql += ' AND t.current_role = ?'; params.push(current_role); }
  if (claimed === 'true') { sql += ' AND t.claimed_by IS NOT NULL'; }
  if (claimed === 'false') { sql += ' AND t.claimed_by IS NULL'; }
  if (blocked === 'true') { sql += ' AND COALESCE(bc.blocker_count, 0) > 0'; }
  if (blocked === 'false') { sql += ' AND COALESCE(bc.blocker_count, 0) = 0'; }

  sql += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  res.status(200).json(tasks);
});
```

## Study

### Test Cases (12 total)

**Existing filters still work (2):**
1. Filter by status returns matching tasks
2. Filter by current_role returns matching tasks

**Claimed filter (2):**
3. ?claimed=true returns only claimed tasks
4. ?claimed=false returns only unclaimed tasks

**Blocked filter (2):**
5. ?blocked=true returns tasks with incomplete dependencies
6. ?blocked=false returns tasks without incomplete dependencies

**Available_only filter (3):**
7. ?available_only=true returns only ready+unclaimed+unblocked tasks
8. ?available_only=true excludes blocked tasks
9. ?available_only=true excludes claimed tasks

**Enrichment (2):**
10. Response includes blocker_count and is_blocked fields
11. blocker_count is 0 for tasks with no dependencies

**Combined filters (1):**
12. Multiple filters combine correctly (status + claimed + blocked)

## Act

### Deployment

- 1 file: tasks.ts (UPDATE — replace GET / handler)
- No migration needed
- Backward compatible — existing ?status and ?current_role filters still work
- New fields in response: blocker_count, is_blocked (enrichment)
