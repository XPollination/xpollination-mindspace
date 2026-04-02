/**
 * Task Announcer — cron that finds ready tasks and announces to the A2A room.
 * Runs every 10 seconds. Agents self-select and claim.
 */

import { getDb } from '../db/connection.js';
import { sendToRole, getConnectedAgents } from './sse-manager.js';
import { logger } from './logger.js';

const ANNOUNCE_INTERVAL_MS = 10_000;
let interval: ReturnType<typeof setInterval> | null = null;

// Track what we've already announced (avoid spamming)
const announced = new Set<string>();

export function startTaskAnnouncer(): void {
  if (interval) return;

  interval = setInterval(() => {
    try {
      announceReadyTasks();
    } catch { /* best effort */ }
  }, ANNOUNCE_INTERVAL_MS);

  logger.info({ interval: ANNOUNCE_INTERVAL_MS }, 'Task announcer started');
}

export function stopTaskAnnouncer(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function announceReadyTasks(): void {
  const db = getDb();
  const connected = getConnectedAgents();
  if (connected.length === 0) return;

  // Find ready tasks without active leases
  const readyTasks = db.prepare(`
    SELECT t.id, t.slug, t.title, t.current_role, t.project_slug, t.dna_json
    FROM tasks t
    WHERE t.status = 'ready'
    AND NOT EXISTS (
      SELECT 1 FROM leases l WHERE l.task_id = t.id AND l.status = 'active'
    )
    ORDER BY t.updated_at ASC
  `).all() as any[];

  for (const task of readyTasks) {
    const announcedKey = `${task.slug}:${task.current_role}`;
    if (announced.has(announcedKey)) continue;

    const role = task.current_role;
    if (!role) continue;

    let dna: any = {};
    try { dna = JSON.parse(task.dna_json || '{}'); } catch { /* */ }

    const sent = sendToRole(role, 'task_available', {
      task_slug: task.slug,
      task_id: task.id,
      title: task.title,
      role,
      project_slug: task.project_slug,
      dna_summary: {
        title: dna.title || task.title,
        description: dna.description?.substring(0, 200),
        acceptance_criteria: dna.acceptance_criteria,
      },
      timestamp: new Date().toISOString(),
    }, task.project_slug);

    if (sent > 0) {
      announced.add(announcedKey);
      // Clear from announced after 60s (re-announce if still unclaimed)
      setTimeout(() => announced.delete(announcedKey), 60_000);
    }
  }
}
