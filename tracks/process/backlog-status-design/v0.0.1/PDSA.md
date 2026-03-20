# PDSA: Backlog Task Status

**Task:** `backlog-status-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
91 PDSA tasks just loaded — most are pending but not ready for work. There's no way to distinguish "planned for future" from "ready to work on now." The monitor shows all pending tasks, creating noise.

### Decision: backlog as a status (not a flag)

**Rationale:** Status is already the primary workflow axis. Adding a flag creates parallel state. A status value integrates naturally with existing query patterns, kanban columns, and transition rules.

### Status Addition

Add `backlog` to the valid status values:
```
backlog → pending → ready → active → ...
```

**Position:** Before `pending`. A backlog task hasn't been scoped enough to be pending. When a mission releases work, tasks move from `backlog` to `pending`.

### Workflow Changes

| Transition | Actor | Meaning |
|-----------|-------|---------|
| `backlog → pending` | liaison, system | Mission releases tasks for planning |
| `pending → backlog` | liaison | Return to backlog (re-prioritize) |

### Monitor Exclusion

`agent-monitor.cjs` currently shows all non-terminal tasks. Add `backlog` to the exclusion list:

```javascript
// agent-monitor.cjs — exclude backlog from actionable work
const EXCLUDED_STATUSES = ['complete', 'cancelled', 'backlog'];
```

### Kanban Exclusion

Viz kanban board should NOT show backlog tasks. They appear only in the Mission Overview with a count badge.

### Mission Release Trigger

When a mission changes state (e.g., mission gets `active` status), all `backlog` tasks linked to that mission's capabilities/requirements move to `pending`:

```sql
-- Bulk transition: backlog → pending for a mission's tasks
UPDATE mindspace_nodes SET status = 'pending'
WHERE status = 'backlog'
AND dna_json LIKE '%requirement_ref%'
AND id IN (
  SELECT mn.id FROM mindspace_nodes mn
  WHERE json_extract(mn.dna_json, '$.requirement_ref') IN (
    SELECT req_id_human FROM requirements r
    JOIN capabilities c ON r.capability_id = c.id
    WHERE c.mission_id = ?
  )
);
```

### Backward Compatibility

- Existing `pending` tasks: unchanged
- New tasks can be created with `status: 'backlog'`
- Monitor, kanban, and viz all exclude `backlog` from active views

## Do

DEV:
1. Add `backlog` to valid statuses in interface-cli.js
2. Add transition rules (backlog→pending, pending→backlog)
3. Exclude from monitor
4. Exclude from kanban
5. Add count badge in mission overview

## Study

Verify:
- `create task my-task '{"title":"x","role":"pdsa","description":"y","status":"backlog"}'` → success
- `transition my-task pending liaison` → success (backlog→pending)
- Monitor --wait doesn't show backlog tasks
- Kanban board doesn't show backlog tasks
- Mission overview shows "N backlog" badge

## Act

### Design Decisions
1. **Status not flag**: Single state axis. No parallel flags to maintain.
2. **Before pending**: Backlog = "not yet scoped." Pending = "scoped, waiting for dependencies."
3. **Mission release**: Bulk transition mechanism. One command activates a mission's work.
4. **Monitor exclusion**: Agents don't see backlog tasks. Reduces noise from 91 to ~3 actionable.
5. **Kanban exclusion**: Clean board. Backlog visible only in aggregate (count badge).
