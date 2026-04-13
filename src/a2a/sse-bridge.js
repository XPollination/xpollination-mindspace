#!/usr/bin/env node
/**
 * SSE Bridge — lightweight per-agent event delivery to Claude terminal
 *
 * Connects to A2A SSE stream, receives events for this role,
 * delivers instructions to Claude's tmux session via send-keys.
 *
 * NO auto-claim. NO brain. NO polling. Pure event-driven delivery.
 *
 * Usage: node src/a2a/sse-bridge.js --role dev --session runner-dev-abc --api-key KEY --api-url URL --project SLUG
 */

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';

const { values: args } = parseArgs({
  options: {
    role: { type: 'string', default: 'dev' },
    session: { type: 'string' },
    'api-key': { type: 'string', default: process.env.BRAIN_API_KEY || process.env.BRAIN_AGENT_KEY || '' },
    'api-url': { type: 'string', default: process.env.MINDSPACE_API_URL || 'http://localhost:3101' },
    project: { type: 'string', default: 'xpollination-mindspace' },
  },
});

const ROLE = args.role;
const SESSION = args.session;
const API_URL = args['api-url'];
const API_KEY = args['api-key'];
const PROJECT = args.project;

if (!SESSION) {
  console.error('Usage: sse-bridge.js --role <role> --session <tmux-session> [--api-key KEY] [--api-url URL]');
  process.exit(1);
}

console.log(`[BRIDGE] ${ROLE} → ${SESSION} | ${API_URL}`);

let agentId = null;
let sessionToken = null;
let reconnectDelay = 5000;
const MAX_RECONNECT_DELAY = 30000;

async function connect() {
  const res = await fetch(`${API_URL}/a2a/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: { agent_name: `bridge-${ROLE}-${SESSION}`, api_key: API_KEY },
      role: { current: ROLE, capabilities: [ROLE] },
      project: { slug: PROJECT },
      state: { status: 'active' },
      metadata: { client: 'sse-bridge', version: '1.0.0' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Connect failed: ${err}`);
  }

  const data = await res.json();
  agentId = data.agent_id;
  sessionToken = data.session_token;
  console.log(`[BRIDGE] Connected. agent_id=${agentId}`);
  reconnectDelay = 5000; // Reset on success
}

function deliverToTmux(message) {
  try {
    execFileSync('tmux', ['send-keys', '-t', SESSION, message, 'Enter'], { timeout: 5000 });
    console.log(`[BRIDGE] Delivered to ${SESSION}`);
  } catch (err) {
    console.error(`[BRIDGE] tmux delivery failed: ${err.message}`);
  }
}

function buildInstruction(eventType, data) {
  const slug = data.task_slug || '';
  const title = data.title || '';
  const role = ROLE;

  // Determine transition target based on event + role
  const transitionMap = {
    task_available: { pdsa: 'approval', dev: 'review', qa: 'review', liaison: 'review' },
    task_assigned: { pdsa: 'approval', dev: 'review', qa: 'review', liaison: 'review' },
    approval_needed: { liaison: 'approved' },
    review_needed: { qa: 'review', pdsa: 'review', liaison: 'complete' },
    rework_needed: { pdsa: 'approval', dev: 'review', qa: 'review' },
  };
  const nextStatus = transitionMap[eventType]?.[role] || 'review';

  // Build instruction based on event type
  const instructions = {
    task_available: `Do the work described.`,
    task_assigned: `Do the work described.`,
    approval_needed: `Review this and approve or reject. Set --findings to your decision.`,
    review_needed: `Review the work. If it passes, forward it.`,
    rework_needed: `Fix the issues: ${data.rework_reason || 'see task DNA'}.`,
  };
  const instruction = instructions[eventType] || 'Process this task.';

  const deliverCmd = `node /app/scripts/a2a-deliver.js --slug ${slug} --transition ${nextStatus} --role ${role}`;
  const context = data.dna?.description?.substring(0, 150) || title;

  return `[TASK] ${slug} — ${title}. Role: ${role}. ${instruction} Context: ${context}. When done: ${deliverCmd}`;
}

async function listenForEvents() {
  const streamUrl = `${API_URL}/a2a/stream/${agentId}`;
  console.log(`[BRIDGE] Opening SSE: ${streamUrl}`);

  const res = await fetch(streamUrl, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  });

  if (!res.ok) throw new Error(`Stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('Stream closed');

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          handleEvent(currentEvent, data);
        } catch { /* parse error */ }
        currentEvent = '';
      } else if (line.startsWith(':')) {
        // Heartbeat comment — ignore
      }
    }
  }
}

function handleEvent(eventType, data) {
  // Events that need tmux delivery
  const deliverEvents = ['task_available', 'task_assigned', 'approval_needed', 'review_needed', 'rework_needed'];

  if (deliverEvents.includes(eventType)) {
    console.log(`[BRIDGE] Event: ${eventType} → ${data.task_slug || ''}`);
    const msg = buildInstruction(eventType, data);
    deliverToTmux(msg);
  } else if (eventType === 'connected') {
    console.log(`[BRIDGE] SSE stream connected`);
  } else {
    // transition, object_*, etc. — UI events, bridge ignores
  }
}

async function heartbeatLoop() {
  while (true) {
    await new Promise(r => setTimeout(r, 25000));
    try {
      await fetch(`${API_URL}/a2a/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ type: 'HEARTBEAT', agent_id: agentId }),
      });
    } catch { /* best effort */ }
  }
}

async function main() {
  while (true) {
    try {
      await connect();
      // Start heartbeat in background
      heartbeatLoop().catch(() => {});
      // Listen for events (blocks until disconnect)
      await listenForEvents();
    } catch (err) {
      console.error(`[BRIDGE] Error: ${err.message}. Reconnecting in ${reconnectDelay / 1000}s...`);
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }
  }
}

main();
