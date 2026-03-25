#!/usr/bin/env node
/**
 * Monitor Skill v2 — A2A-native agent loop
 * Replaces xpo.claude.monitor: connects via A2A, receives events via SSE, no polling.
 *
 * Usage: node src/a2a/monitor-v2.js <role>
 *
 * Flow:
 *   1. Connect to A2A (agent identity from role)
 *   2. Query brain for role recovery context
 *   3. Subscribe to SSE event stream
 *   4. Process events as they arrive (no polling)
 *   5. On task_assigned: claim → work → transition
 */

import { connect, startEventStream, sendMessage, heartbeat } from './a2a-agent.js';

const role = process.argv[2] || 'dev';
const ROLE_UPPER = role.toUpperCase();

console.log(`[MONITOR-V2] Starting ${ROLE_UPPER} agent (A2A-native)`);
console.log('[MONITOR-V2] No polling. No work files. Events arrive via SSE.');

async function queryBrainForRecovery() {
  try {
    const result = await sendMessage('BRAIN_QUERY', {
      prompt: `Recovery protocol and role definition for ${role} agent. Current task state and recent decisions.`,
      read_only: true,
    });
    if (result?.result?.response) {
      console.log(`[BRAIN] Recovery context loaded (${result.result.sources?.length || 0} sources)`);
    }
  } catch {
    console.log('[BRAIN] Brain unavailable — continuing without recovery context');
  }
}

async function onTaskAssigned(data) {
  console.log(`[${ROLE_UPPER}] Task assigned: ${data.task_slug} — ${data.title}`);
  console.log(`[${ROLE_UPPER}]   Available transitions: ${(data.available_transitions || []).map(t => t.to_status).join(', ')}`);

  // Claim: transition ready → active
  try {
    const result = await sendMessage('TRANSITION', {
      task_slug: data.task_slug,
      to_status: 'active',
      payload: { memory_query_session: 'a2a-monitor-v2' },
    });
    if (result.type === 'ACK') {
      console.log(`[${ROLE_UPPER}] Claimed: ${data.task_slug} → active`);
    } else {
      console.log(`[${ROLE_UPPER}] Claim failed: ${result.error || 'unknown'}`);
    }
  } catch (err) {
    console.log(`[${ROLE_UPPER}] Claim error: ${err.message}`);
  }
}

async function onReviewNeeded(data) {
  console.log(`[${ROLE_UPPER}] Review needed: ${data.task_slug} (from ${data.from_role})`);
}

async function onReworkNeeded(data) {
  console.log(`[${ROLE_UPPER}] Rework needed: ${data.task_slug} — ${data.rework_reason || 'no reason given'}`);
}

async function onApprovalNeeded(data) {
  console.log(`[${ROLE_UPPER}] Approval needed: ${data.task_slug} — ${data.title}`);
}

(async () => {
  try {
    // Step 1: Connect
    await connect();
    console.log(`[MONITOR-V2] ${ROLE_UPPER} connected to A2A`);

    // Step 2: Recovery from brain
    await queryBrainForRecovery();

    // Step 3: Heartbeat
    setInterval(() => heartbeat().catch(() => {}), 25000);

    // Step 4: Event stream
    console.log(`[MONITOR-V2] Listening for ${ROLE_UPPER} events...`);
    await startEventStream({
      task_assigned: (_, d) => onTaskAssigned(d),
      review_needed: (_, d) => onReviewNeeded(d),
      rework_needed: (_, d) => onReworkNeeded(d),
      approval_needed: (_, d) => onApprovalNeeded(d),
      task_blocked: (_, d) => console.log(`[BLOCKED] ${d.task_slug}: ${d.blocked_reason}`),
      transition: (_, d) => console.log(`[FLOW] ${d.task_slug}: ${d.from_status} → ${d.to_status}`),
      connected: () => console.log(`[SSE] ${ROLE_UPPER} stream connected`),
      default: (e, d) => console.log(`[${e}] ${JSON.stringify(d).slice(0, 100)}`),
    });
  } catch (err) {
    console.error(`[MONITOR-V2] Fatal: ${err.message}`);
    process.exit(1);
  }
})();
