/**
 * Process Manager — agent process lifecycle with crash recovery and backoff
 * Tracks agent processes in-memory. Processes don't survive server restart.
 */

import { executeTurn } from './turn-engine.js';
import { getDb } from '../db/connection.js';
import { disconnectSession } from './session-store.js';
import { releaseLease } from './lease-manager.js';

interface AgentProcess {
  agent_id: string;
  session_id: string;
  user_id: string;
  project_slug: string;
  role: string;
  status: 'spawning' | 'running' | 'idle' | 'stopped' | 'failed';
  started_at: string;
  restart_count: number;
  last_crash_at: string | null;
  backoff_ms: number;
  last_stable_at: string;
}

const processes = new Map<string, AgentProcess>();
const MAX_RESTARTS = 5;
const MAX_BACKOFF_MS = 60_000;
const STABLE_RESET_MS = 5 * 60 * 1000; // Reset backoff after 5min stable

export function spawn(agentId: string, config: { session_id: string; user_id: string; project_slug?: string; role: string }): AgentProcess {
  // Stop existing process if any
  const existing = processes.get(agentId);
  if (existing && existing.status === 'running') {
    stop(agentId);
  }

  const proc: AgentProcess = {
    agent_id: agentId,
    session_id: config.session_id,
    user_id: config.user_id,
    project_slug: config.project_slug,
    role: config.role,
    status: 'running',
    started_at: new Date().toISOString(),
    restart_count: 0,
    last_crash_at: null,
    backoff_ms: 1000,
    last_stable_at: new Date().toISOString(),
  };

  processes.set(agentId, proc);
  return proc;
}

export function stop(agentId: string): boolean {
  const proc = processes.get(agentId);
  if (!proc) return false;

  proc.status = 'stopped';

  // Clean up session and leases
  const db = getDb();
  try { disconnectSession(db, proc.session_id); } catch { /* ignore */ }
  try { releaseLease(db, '', proc.user_id); } catch { /* ignore */ }

  return true;
}

export async function restart(agentId: string): Promise<AgentProcess | null> {
  const proc = processes.get(agentId);
  if (!proc) return null;

  // Apply backoff
  await new Promise(resolve => setTimeout(resolve, proc.backoff_ms));

  proc.restart_count++;
  proc.backoff_ms = Math.min(proc.backoff_ms * 2, MAX_BACKOFF_MS);
  proc.status = 'running';
  proc.started_at = new Date().toISOString();

  return proc;
}

export function onCrash(agentId: string, error?: string): void {
  const proc = processes.get(agentId);
  if (!proc) return;

  proc.last_crash_at = new Date().toISOString();
  proc.status = 'stopped';

  // Reset backoff if was stable for 5min+
  if (Date.now() - new Date(proc.last_stable_at).getTime() > STABLE_RESET_MS) {
    proc.backoff_ms = 1000;
    proc.restart_count = 0;
  }

  if (proc.restart_count < MAX_RESTARTS) {
    // Schedule restart with backoff
    setTimeout(() => restart(agentId), proc.backoff_ms);
  } else {
    proc.status = 'failed';
    // Notify liaison via brain or SSE
    console.error(`Agent ${agentId} failed after ${MAX_RESTARTS} restarts: ${error}`);
  }
}

export function markStable(agentId: string): void {
  const proc = processes.get(agentId);
  if (proc) proc.last_stable_at = new Date().toISOString();
}

/**
 * Handle an incoming SSE event for an agent — execute a turn
 */
export async function handleEvent(agentId: string, event: any): Promise<any> {
  const proc = processes.get(agentId);
  if (!proc || proc.status !== 'running') return null;

  try {
    const result = await executeTurn(event, {
      agent_id: proc.agent_id,
      user_id: proc.user_id,
      project_slug: proc.project_slug,
      role: proc.role,
    });
    markStable(agentId);
    return result;
  } catch (err: any) {
    onCrash(agentId, err.message);
    return { success: false, error: err.message };
  }
}

export function list(userId?: string): AgentProcess[] {
  const all = Array.from(processes.values());
  if (userId) return all.filter(p => p.user_id === userId);
  return all;
}

export function getProcess(agentId: string): AgentProcess | null {
  return processes.get(agentId) || null;
}

// Cleanup on server shutdown
export function shutdownAll(): void {
  for (const [agentId] of processes) {
    stop(agentId);
  }
  processes.clear();
}

// Register cleanup
process.on('SIGTERM', shutdownAll);
process.on('SIGINT', shutdownAll);
