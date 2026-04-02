/**
 * Task Announcer — cron that finds ready tasks and announces to the A2A room.
 * Runs every 10 seconds. Agents self-select and claim.
 */

import { getDb } from '../db/connection.js';
import { sendToRole, getConnectedAgents } from './sse-manager.js';
import { logger } from './logger.js';
import { execFileSync } from 'node:child_process';
import { buildInstructionText, getInstructions, validateTransition } from './workflow-engine.js';
import { grantLease } from './lease-manager.js';

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

    // Try SSE first
    const sent = sendToRole(role, 'task_available', {
      task_slug: task.slug, task_id: task.id, title: task.title, role,
      project_slug: task.project_slug,
      dna_summary: { title: dna.title || task.title, description: dna.description?.substring(0, 200) },
      timestamp: new Date().toISOString(),
    }, task.project_slug);

    // Also deliver directly to tmux agent sessions (bridge while agents don't have SSE)
    if (sent === 0) {
      // Find an idle agent with matching role that has a tmux session
      const agent = db.prepare(
        `SELECT id, session_id, current_role, user_id FROM agents
         WHERE current_role = ? AND status = 'active' AND session_id LIKE 'runner-%'
         ORDER BY last_seen DESC LIMIT 1`
      ).get(role) as any;

      if (agent) {
        // Auto-claim on behalf of agent and deliver instructions
        const claimDna = { ...dna, memory_query_session: 'auto-claim' };
        const validation = validateTransition('ready', 'active', role, claimDna, db);
        if (validation.valid) {
          const now = new Date().toISOString();
          db.prepare('UPDATE tasks SET status = ?, claimed_by = ?, claimed_at = ?, dna_json = ?, updated_at = ? WHERE id = ?')
            .run('active', agent.id, now, JSON.stringify(claimDna), now, task.id);
          try { grantLease(db, task.id, agent.user_id || agent.id); } catch { /* */ }

          // Build and deliver instructions to tmux
          const instructions = buildInstructionText(role, task, dna);
          try {
            execFileSync('tmux', ['send-keys', '-t', agent.session_id, instructions, 'Enter'], { timeout: 5000 });
            logger.info({ slug: task.slug, agent: agent.session_id }, 'Task delivered to agent');
          } catch { /* tmux may not exist */ }

          announced.add(announcedKey);
          continue;
        }
      }
    }

    if (sent > 0) {
      announced.add(announcedKey);
    }
    // Clear from announced after 60s (re-announce if still unclaimed)
    setTimeout(() => announced.delete(announcedKey), 60_000);
  }
}
