/**
 * Task Distributor — least-loaded agent assignment for parallel agents
 * Multiple agents per role. Server picks agent with fewest active leases.
 */

import { sendToAgent } from './sse-manager.js';
import { EVENT_TYPES, buildTaskAssigned } from './event-types.js';
import { workflowContext } from '../../src/twins/task-twin.js';
import { createTask } from '../../src/twins/task-twin.js';

interface AgentLoad {
  agent_id: string;
  session_id: string;
  role: string;
  active_leases: number;
}

export function assign(db: any, task: any, role: string, dna?: any): { assigned: boolean; agent_id?: string; reason?: string } {
  // Find active sessions for this role
  const sessions = db.prepare(
    "SELECT id, agent_id, role FROM agent_sessions WHERE role = ? AND status = 'active'"
  ).all(role) as { id: string; agent_id: string; role: string }[];

  if (sessions.length === 0) {
    return { assigned: false, reason: `No active agents with role ${role}` };
  }

  // Count active leases per agent
  const loads: AgentLoad[] = sessions.map(s => {
    const { count } = db.prepare(
      "SELECT COUNT(*) as count FROM leases WHERE session_id = ? AND status = 'active'"
    ).get(s.id) as { count: number };
    return { agent_id: s.agent_id, session_id: s.id, role: s.role, active_leases: count };
  });

  // Sort by least loaded
  loads.sort((a, b) => a.active_leases - b.active_leases);
  const target = loads[0];

  // Build event payload
  const twin = createTask({ slug: task.slug || task.id, status: 'ready', dna: { ...dna, role } });
  const transitions = workflowContext(twin).available_transitions;
  const eventData = buildTaskAssigned(task, dna || {}, transitions);

  // Send to least-loaded agent
  const sent = sendToAgent(target.agent_id, EVENT_TYPES.TASK_ASSIGNED, eventData);

  return { assigned: sent, agent_id: target.agent_id };
}

export function onAgentConnect(db: any, agentId: string, role: string, projectSlug?: string): number {
  // Check for unassigned ready tasks for this role
  let sql = "SELECT * FROM tasks WHERE status = 'ready' AND current_role = ?";
  const params: any[] = [role];
  if (projectSlug) { sql += ' AND project_slug = ?'; params.push(projectSlug); }
  sql += ' ORDER BY updated_at ASC';

  const readyTasks = db.prepare(sql).all(...params) as any[];
  let assigned = 0;

  for (const task of readyTasks) {
    // Check no active lease exists
    const lease = db.prepare("SELECT id FROM leases WHERE task_id = ? AND status = 'active'").get(task.id);
    if (lease) continue;

    let dna: any = {};
    try { dna = JSON.parse(task.dna_json || '{}'); } catch {}

    const twin = createTask({ slug: task.slug || task.id, status: 'ready', dna: { ...dna, role } });
    const transitions = workflowContext(twin).available_transitions;
    const eventData = buildTaskAssigned(task, dna, transitions);

    if (sendToAgent(agentId, EVENT_TYPES.TASK_ASSIGNED, eventData)) assigned++;
    break; // Only assign one task per connect to avoid overwhelming
  }

  return assigned;
}

export function getDistribution(db: any): { role: string; agent_id: string; active_tasks: number }[] {
  const sessions = db.prepare("SELECT id, agent_id, role FROM agent_sessions WHERE status = 'active'").all() as any[];
  return sessions.map((s: any) => {
    const { count } = db.prepare("SELECT COUNT(*) as count FROM leases WHERE session_id = ? AND status = 'active'").get(s.id) as { count: number };
    return { role: s.role, agent_id: s.agent_id, active_tasks: count };
  });
}
