import type Database from 'better-sqlite3';

/**
 * Detect if adding a dependency from taskId -> blockedByTaskId would create a cycle.
 * Uses BFS from blockedByTaskId to check if taskId is reachable via existing dependencies.
 */
export function detectCycle(
  db: Database.Database,
  taskId: string,
  blockedByTaskId: string
): { hasCycle: boolean; path: string[] } {
  // BFS: start from blockedByTaskId, follow its dependencies (blocked_by_task_id edges)
  // If we can reach taskId, adding taskId -> blockedByTaskId would create a cycle
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [blockedByTaskId];
  visited.add(blockedByTaskId);

  const stmt = db.prepare(
    'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
  );

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === taskId) {
      // Reconstruct cycle path
      const cyclePath: string[] = [current];
      let node = blockedByTaskId;
      const pathNodes: string[] = [blockedByTaskId];
      // Walk parent map from blockedByTaskId to taskId
      let walker = current;
      const trail: string[] = [walker];
      while (walker !== blockedByTaskId && parent.has(walker)) {
        walker = parent.get(walker)!;
        trail.push(walker);
      }
      trail.reverse();
      return { hasCycle: true, path: trail };
    }

    const deps = stmt.all(current) as { blocked_by_task_id: string }[];
    for (const dep of deps) {
      if (!visited.has(dep.blocked_by_task_id)) {
        visited.add(dep.blocked_by_task_id);
        parent.set(dep.blocked_by_task_id, current);
        queue.push(dep.blocked_by_task_id);
      }
    }
  }

  return { hasCycle: false, path: [] };
}
