/**
 * Cascade Engine — forward cascade on task completion
 * When a task completes, check dependents and unblock those whose
 * all blocking tasks are now complete.
 */

import { broadcast } from './sse-manager.js';

interface CascadeResult {
  unblocked: { task_id: string; slug: string; title: string }[];
  still_blocked: { task_id: string; blocking_tasks: string[] }[];
}

export function cascadeForward(completedTaskId: string, db: any): CascadeResult {
  const result: CascadeResult = { unblocked: [], still_blocked: [] };

  // Find all tasks that depend on the completed task
  const dependents = db.prepare(
    'SELECT DISTINCT task_id FROM task_dependencies WHERE blocked_by_task_id = ?'
  ).all(completedTaskId) as { task_id: string }[];

  if (dependents.length === 0) return result;

  const visited = new Set<string>();

  for (const { task_id } of dependents) {
    if (visited.has(task_id)) continue;
    visited.add(task_id);

    // Get the dependent task
    const task = db.prepare('SELECT id, slug, title, status FROM tasks WHERE id = ?').get(task_id) as any;
    if (!task) continue;

    // Skip if already past pending (idempotent)
    if (task.status !== 'pending') continue;

    // Check ALL blocking dependencies for this task
    const allBlockers = db.prepare(
      'SELECT blocked_by_task_id FROM task_dependencies WHERE task_id = ?'
    ).all(task_id) as { blocked_by_task_id: string }[];

    const incompleteBlockers: string[] = [];
    for (const { blocked_by_task_id } of allBlockers) {
      const blocker = db.prepare('SELECT status FROM tasks WHERE id = ?').get(blocked_by_task_id) as any;
      if (!blocker || blocker.status !== 'complete') {
        incompleteBlockers.push(blocked_by_task_id);
      }
    }

    if (incompleteBlockers.length === 0) {
      // All blockers complete → transition pending → ready
      db.prepare("UPDATE tasks SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(task_id);
      result.unblocked.push({ task_id, slug: task.slug, title: task.title });
    } else {
      result.still_blocked.push({ task_id, blocking_tasks: incompleteBlockers });
    }
  }

  // Broadcast if any tasks were unblocked
  if (result.unblocked.length > 0) {
    broadcast('cascade_forward', {
      triggered_by: completedTaskId,
      unblocked: result.unblocked.map(t => t.slug),
      timestamp: new Date().toISOString()
    });
  }

  return result;
}
