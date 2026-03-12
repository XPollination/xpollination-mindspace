import { getDb } from '../db/connection.js';

export function buildWelcomeContext(projectSlug: string, agentRole?: string): any {
  const db = getDb();

  // Get active mission (first active mission — typically one per project)
  const mission = db.prepare(
    "SELECT id, title, status FROM missions WHERE status = 'active' LIMIT 1"
  ).get() as any;

  // Get capabilities with progress
  const capabilities = mission
    ? db.prepare(
        'SELECT id, title, status, sort_order FROM capabilities WHERE mission_id = ? ORDER BY sort_order'
      ).all(mission.id) as any[]
    : [];

  const capsWithProgress = capabilities.map(cap => {
    const taskSlugs = db.prepare(
      'SELECT task_slug FROM capability_tasks WHERE capability_id = ?'
    ).all(cap.id).map((r: any) => r.task_slug);

    let completeCount = 0;
    for (const slug of taskSlugs) {
      const task = db.prepare(
        'SELECT status FROM tasks WHERE id = ?'
      ).get(slug) as any;
      if (task && task.status === 'complete') {
        completeCount++;
      }
    }

    const taskCount = taskSlugs.length;
    const progressPercent = taskCount > 0 ? Math.round((completeCount / taskCount) * 100) : 0;

    return {
      id: cap.id,
      title: cap.title,
      status: cap.status,
      task_count: taskCount,
      progress_percent: progressPercent
    };
  });

  // Count pending tasks for the agent's role
  let pendingTasks = 0;
  if (agentRole) {
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE project_slug = ? AND current_role = ?'
    ).get(projectSlug, agentRole) as any;
    pendingTasks = result?.count || 0;
  }

  return {
    mission: mission ? { id: mission.id, title: mission.title, status: mission.status } : null,
    capabilities: capsWithProgress,
    pending_tasks: pendingTasks
  };
}
