import type Database from 'better-sqlite3';

/**
 * Check dependents of a completed task and auto-unblock those whose all blockers are complete.
 * Returns array of task IDs that were unblocked (status changed from blocked to ready).
 */
export function checkAndUnblock(
  db: Database.Database,
  completedTaskId: string
): string[] {
  const auto_unblocked: string[] = [];

  // Find all tasks that depend on (are blocked by) the completed task
  const dependents = db.prepare(
    'SELECT DISTINCT task_id FROM task_dependencies WHERE blocked_by_task_id = ?'
  ).all(completedTaskId) as { task_id: string }[];

  for (const dep of dependents) {
    // Check if the dependent task is currently blocked
    const task = db.prepare('SELECT id, status FROM tasks WHERE id = ?').get(dep.task_id) as any;
    if (!task || task.status !== 'blocked') continue;

    // Check if ALL blocking tasks for this dependent are now complete
    const incompleteBlockers = db.prepare(
      `SELECT COUNT(*) as count FROM task_dependencies td
       JOIN tasks t ON t.id = td.blocked_by_task_id
       WHERE td.task_id = ? AND t.status != 'complete'`
    ).get(dep.task_id) as { count: number };

    if (incompleteBlockers.count === 0) {
      // All blockers complete — unblock: change status from blocked to ready
      db.prepare(
        "UPDATE tasks SET status = 'ready', updated_at = datetime('now') WHERE id = ?"
      ).run(dep.task_id);
      auto_unblocked.push(dep.task_id);
    }
  }

  return auto_unblocked;
}
