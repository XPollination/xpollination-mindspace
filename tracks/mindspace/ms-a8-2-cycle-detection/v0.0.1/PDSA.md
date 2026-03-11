# PDSA: Cycle Detection on Dependency Creation

**Task:** ms-a8-2-cycle-detection
**Status:** Design
**Version:** v0.0.1

## Plan

Before inserting a new dependency edge, run DFS from the proposed blocker task to check if the dependent task is reachable (which would create a cycle). Reject with 400 if cycle detected.

### Dependencies

- **ms-a8-1-dependency-table** (complete): task_dependencies table + CRUD endpoints

### Investigation

**Existing code (task-dependencies.ts lines 52-98):**
POST /dependencies validates: task exists, blocker exists, no self-dependency, no duplicate. But does NOT check for cycles.

**DNA description:** Before inserting dependency: run DFS/BFS from blocker to check if task_id is reachable (would create cycle). Reject with 400.

**Example cycle:** A depends_on B, B depends_on C. If C depends_on A is attempted → cycle A→B→C→A.

**Design decisions:**
- Add cycle detection as a service function (reusable)
- DFS from blocked_by_task_id, following forward edges (task_dependencies.task_id → blocked_by_task_id), checking if task_id is reachable
- If task_id found in DFS traversal, reject with descriptive error showing the cycle path
- Insert check in POST /dependencies handler, before the INSERT
- Max depth limit of 100 to prevent pathological cases

## Do

### File Changes

#### 1. `api/services/cycle-detection.ts` (NEW)

```typescript
import { getDb } from '../db/connection.js';

/**
 * Detect if adding edge (taskId → blockedByTaskId) would create a cycle.
 * Uses DFS from blockedByTaskId following dependency edges.
 * Returns { hasCycle: false } or { hasCycle: true, path: string[] }.
 */
export function detectCycle(taskId: string, blockedByTaskId: string): { hasCycle: boolean; path?: string[] } {
  const db = getDb();
  const visited = new Set<string>();
  const path: string[] = [blockedByTaskId];

  function dfs(current: string, depth: number): boolean {
    if (depth > 100) return false; // safety limit
    if (current === taskId) return true; // cycle found
    if (visited.has(current)) return false;
    visited.add(current);

    // Follow edges: current depends on what? (current is task_id, get blocked_by_task_id)
    const deps = db.prepare(
      'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
    ).all(current) as { blocked_by_task_id: string }[];

    for (const dep of deps) {
      path.push(dep.blocked_by_task_id);
      if (dfs(dep.blocked_by_task_id, depth + 1)) return true;
      path.pop();
    }

    return false;
  }

  const hasCycle = dfs(blockedByTaskId, 0);
  return hasCycle ? { hasCycle: true, path: [taskId, ...path] } : { hasCycle: false };
}
```

#### 2. `api/routes/task-dependencies.ts` (UPDATE)

Add import and cycle check before INSERT in POST /dependencies:

```typescript
import { detectCycle } from '../services/cycle-detection.js';

// After duplicate check, before INSERT:
const cycleResult = detectCycle(taskId, blocked_by_task_id);
if (cycleResult.hasCycle) {
  res.status(400).json({
    error: 'Adding this dependency would create a cycle',
    cycle: cycleResult.path
  });
  return;
}
```

## Study

### Test Cases (8 total)

**Direct cycle (2):**
1. A→B exists, B→A rejected with cycle error
2. Error includes cycle path [A, B, A]

**Indirect cycle (2):**
3. A→B, B→C exist, C→A rejected
4. Error includes cycle path [A, B, C, A]

**No cycle (2):**
5. A→B exists, C→A allowed (no cycle)
6. A→B, C→D allowed (disconnected graphs)

**Edge cases (2):**
7. Self-dependency still rejected (existing check, before cycle check)
8. Diamond dependency (A→B, A→C, B→D, C→D) allowed — not a cycle

## Act

### Deployment

- 2 files: cycle-detection.ts (NEW), task-dependencies.ts (UPDATE)
- No migration needed
- Integrates into existing POST /dependencies flow
