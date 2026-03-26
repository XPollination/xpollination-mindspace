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
 *   5. On task_assigned: claim → work → submit findings → transition
 */

import { connect, startEventStream, sendMessage, heartbeat } from './a2a-agent.js';
import { randomUUID } from 'node:crypto';

const role = process.argv[2] || 'dev';
const ROLE_UPPER = role.toUpperCase();
const sessionId = randomUUID();

console.log(`[MONITOR-V2] Starting ${ROLE_UPPER} agent (A2A-native)`);
console.log(`[MONITOR-V2] Session: ${sessionId}`);
console.log('[MONITOR-V2] No polling. No work files. Events arrive via SSE.');

async function queryBrain(prompt, readOnly = true) {
  try {
    const result = await sendMessage('BRAIN_QUERY', {
      prompt,
      session_id: sessionId,
      read_only: readOnly,
    });
    return result?.result || null;
  } catch {
    return null;
  }
}

async function contributeToBrain(prompt, context) {
  try {
    await sendMessage('BRAIN_CONTRIBUTE', {
      prompt,
      session_id: sessionId,
      context: context || undefined,
    });
  } catch { /* best effort */ }
}

async function queryBrainForRecovery() {
  const result = await queryBrain(`Recovery protocol and role definition for ${role} agent. Current task state and recent decisions.`);
  if (result?.response) {
    console.log(`[BRAIN] Recovery context loaded (${result.sources?.length || 0} sources)`);
  } else {
    console.log('[BRAIN] Brain unavailable — continuing without recovery context');
  }
}

async function onTaskAssigned(data) {
  console.log(`[${ROLE_UPPER}] Task assigned: ${data.task_slug} — ${data.title}`);
  console.log(`[${ROLE_UPPER}]   Available transitions: ${(data.available_transitions || []).map(t => t.to_status).join(', ')}`);

  // Step 1: Claim — transition ready → active
  try {
    const claimResult = await sendMessage('TRANSITION', {
      task_slug: data.task_slug,
      to_status: 'active',
      payload: { memory_query_session: sessionId },
    });
    if (claimResult.type !== 'ACK') {
      console.log(`[${ROLE_UPPER}] Claim failed: ${claimResult.error || 'unknown'}`);
      return;
    }
    console.log(`[${ROLE_UPPER}] Claimed: ${data.task_slug} → active`);
  } catch (err) {
    console.log(`[${ROLE_UPPER}] Claim error: ${err.message}`);
    return;
  }

  // Step 2: Brain query for task context
  await queryBrain(`Context for task ${data.task_slug}: ${data.title}. What do I need to know?`);

  // Step 3: Signal that work would be done here
  // In full Agent OS: the turn engine (a2a-event-handler.js) processes work via Claude API
  // In monitor-v2: we log that work is needed and await human/Claude intervention
  console.log(`[${ROLE_UPPER}] Task ${data.task_slug} claimed and active. Awaiting work execution.`);
  console.log(`[${ROLE_UPPER}] Use a2a-event-handler.js for autonomous Claude-powered work.`);
}

async function submitWork(taskSlug, findings, toStatus = 'review') {
  // Step 4: Write findings to DNA
  try {
    await sendMessage('TRANSITION', {
      task_slug: taskSlug,
      to_status: toStatus,
      payload: { findings, implementation: findings },
    });
    console.log(`[${ROLE_UPPER}] Submitted: ${taskSlug} → ${toStatus}`);
  } catch (err) {
    console.log(`[${ROLE_UPPER}] Submit error: ${err.message}`);
  }

  // Step 5: Contribute learning to brain
  await contributeToBrain(
    `TASK ${toStatus.toUpperCase()}: ${ROLE_UPPER} ${taskSlug} — work submitted`,
    `task: ${taskSlug}`
  );
}

async function onReviewNeeded(data) {
  console.log(`[${ROLE_UPPER}] Review needed: ${data.task_slug} (from ${data.from_role})`);
  // Claim for review
  try {
    await sendMessage('TRANSITION', { task_slug: data.task_slug, to_status: 'active' });
    console.log(`[${ROLE_UPPER}] Review claimed: ${data.task_slug}`);
  } catch { /* may not be claimable */ }
}

async function onReworkNeeded(data) {
  console.log(`[${ROLE_UPPER}] Rework needed: ${data.task_slug} — ${data.rework_reason || 'no reason given'}`);
  // Reclaim for rework
  try {
    await sendMessage('TRANSITION', { task_slug: data.task_slug, to_status: 'active' });
    console.log(`[${ROLE_UPPER}] Rework claimed: ${data.task_slug}`);
  } catch { /* may not be claimable */ }
}

async function onApprovalNeeded(data) {
  console.log(`[${ROLE_UPPER}] Approval needed: ${data.task_slug} — ${data.title}`);
}

// Export submitWork for external use
export { submitWork, queryBrain, contributeToBrain };

(async () => {
  try {
    await connect();
    console.log(`[MONITOR-V2] ${ROLE_UPPER} connected to A2A`);

    await queryBrainForRecovery();

    setInterval(() => heartbeat().catch(() => {}), 25000);

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
