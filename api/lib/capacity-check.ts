/**
 * Station Capacity Check — gate agent spawn based on station.json config
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CapacityResult {
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}

const PROJECT_ROOT = resolve(import.meta.dirname || __dirname, '../..');
let cachedConfig: any = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30s

function loadStationConfig(): any {
  if (cachedConfig && Date.now() - cacheTime < CACHE_TTL) return cachedConfig;
  try {
    const path = resolve(PROJECT_ROOT, '.xpollination/station.json');
    cachedConfig = JSON.parse(readFileSync(path, 'utf-8'));
    cacheTime = Date.now();
  } catch {
    cachedConfig = { capacity: { max_agents: 4, max_per_role: { liaison: 1 }, reserved: 0 } };
  }
  return cachedConfig;
}

export function checkCapacity(db: any, role?: string): CapacityResult {
  const config = loadStationConfig();
  const cap = config.capacity || { max_agents: 4, max_per_role: {}, reserved: 0 };
  const maxAgents = cap.max_agents - (cap.reserved || 0);

  const { count: current } = db.prepare(
    "SELECT COUNT(*) as count FROM agent_sessions WHERE status = 'active'"
  ).get() as { count: number };

  if (current >= maxAgents) {
    return { allowed: false, current, max: maxAgents, reason: `Station at capacity (${current}/${maxAgents})` };
  }

  // Per-role limit
  if (role && cap.max_per_role?.[role]) {
    const { count: roleCount } = db.prepare(
      "SELECT COUNT(*) as count FROM agent_sessions WHERE status = 'active' AND role = ?"
    ).get(role) as { count: number };

    if (roleCount >= cap.max_per_role[role]) {
      return { allowed: false, current, max: maxAgents, reason: `Max ${cap.max_per_role[role]} ${role} agent(s) allowed` };
    }
  }

  return { allowed: true, current, max: maxAgents };
}

export function getCapacityInfo(db: any): { current: number; max: number; by_role: Record<string, number> } {
  const config = loadStationConfig();
  const cap = config.capacity || { max_agents: 4 };
  const { count: current } = db.prepare("SELECT COUNT(*) as count FROM agent_sessions WHERE status = 'active'").get() as { count: number };
  const roles = db.prepare("SELECT role, COUNT(*) as count FROM agent_sessions WHERE status = 'active' GROUP BY role").all() as any[];
  const byRole: Record<string, number> = {};
  for (const r of roles) byRole[r.role] = r.count;
  return { current, max: cap.max_agents, by_role: byRole };
}
