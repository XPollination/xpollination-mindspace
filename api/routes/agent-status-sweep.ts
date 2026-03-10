import { getDb } from '../db/connection.js';
import { logger } from '../lib/logger.js';

const AGENT_IDLE_MINUTES = parseInt(process.env.AGENT_IDLE_MINUTES || '5', 10);
const AGENT_DISCONNECT_MINUTES = parseInt(process.env.AGENT_DISCONNECT_MINUTES || '30', 10);
const SWEEP_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Run one sweep: transition active→idle and idle→disconnected
 * based on last_seen timestamps.
 */
export function sweepAgentStatuses(): { idled: number; disconnected: number } {
  const db = getDb();

  // active → idle: last_seen older than AGENT_IDLE_MINUTES
  const idleResult = db.prepare(
    `UPDATE agents SET status = 'idle'
     WHERE status = 'active'
     AND last_seen < datetime('now', '-' || ? || ' minutes')`
  ).run(AGENT_IDLE_MINUTES);

  // idle → disconnected: last_seen older than AGENT_DISCONNECT_MINUTES
  const disconnectResult = db.prepare(
    `UPDATE agents SET status = 'disconnected', disconnected_at = datetime('now')
     WHERE status = 'idle'
     AND last_seen < datetime('now', '-' || ? || ' minutes')`
  ).run(AGENT_DISCONNECT_MINUTES);

  return {
    idled: idleResult.changes,
    disconnected: disconnectResult.changes
  };
}

/**
 * Start the background sweep on a setInterval timer.
 * Returns the interval ID for cleanup.
 */
export function startAgentSweep(): NodeJS.Timeout {
  logger.info({ idleMinutes: AGENT_IDLE_MINUTES, disconnectMinutes: AGENT_DISCONNECT_MINUTES },
    'Agent status sweep started');

  return setInterval(() => {
    try {
      const result = sweepAgentStatuses();
      if (result.idled > 0 || result.disconnected > 0) {
        logger.info(result, 'Agent sweep completed');
      }
    } catch (err) {
      logger.error({ err }, 'Agent sweep failed');
    }
  }, SWEEP_INTERVAL_MS);
}
