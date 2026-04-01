/**
 * Task Bridge — dual-write sync between SQLite (kanban) and MindspaceNode (twin store).
 *
 * - createTwinFromTask: SQLite task → twin in MindspaceNode (when task goes ready)
 * - syncClaimToSqlite: runner claimed twin → update SQLite status
 * - syncResultToSqlite: runner completed → write result to SQLite DNA
 */

import { getNode } from '../services/mindspace-node-service.js';
import { broadcast } from './sse-manager.js';
import { logger } from './logger.js';

export async function createTwinFromTask(db: any, task: any): Promise<void> {
  const node = getNode();
  if (!node) return;

  const dna = typeof task.dna_json === 'string' ? JSON.parse(task.dna_json || '{}') : (task.dna_json || {});

  try {
    await node.createTask({
      title: task.title || dna.title || task.slug,
      description: dna.description || task.description,
      role: task.current_role || dna.role,
      project: task.project_slug,
      logicalId: task.slug,
      actor: 'liaison',
    });
    logger.info({ slug: task.slug, role: task.current_role }, 'Bridge: twin created from SQLite task');
  } catch (err: any) {
    // Twin may already exist (idempotent)
    if (!err.message?.includes('already exists')) {
      logger.warn({ slug: task.slug, err: err.message }, 'Bridge: failed to create twin');
    }
  }
}

export function syncClaimToSqlite(db: any, slug: string, runnerId: string): void {
  try {
    db.prepare(
      `UPDATE tasks SET status = 'active', claimed_by = ?, claimed_at = datetime('now'), updated_at = datetime('now') WHERE slug = ?`
    ).run(runnerId, slug);
    broadcast('runner_claim', { task_slug: slug, runner_id: runnerId, timestamp: new Date().toISOString() });
    logger.info({ slug, runnerId }, 'Bridge: claim synced to SQLite');
  } catch (err: any) {
    logger.warn({ slug, err: err.message }, 'Bridge: failed to sync claim');
  }
}

export function syncResultToSqlite(db: any, slug: string, result: string, nextStatus: string): void {
  try {
    const task = db.prepare('SELECT id, dna_json FROM tasks WHERE slug = ?').get(slug) as any;
    if (!task) return;

    const dna = JSON.parse(task.dna_json || '{}');
    dna.runner_output = result;
    dna.runner_completed_at = new Date().toISOString();

    db.prepare(
      `UPDATE tasks SET dna_json = ?, status = ?, updated_at = datetime('now') WHERE slug = ?`
    ).run(JSON.stringify(dna), nextStatus, slug);

    broadcast('transition', { task_slug: slug, to_status: nextStatus, timestamp: new Date().toISOString() });
    logger.info({ slug, nextStatus }, 'Bridge: result synced to SQLite');
  } catch (err: any) {
    logger.warn({ slug, err: err.message }, 'Bridge: failed to sync result');
  }
}
