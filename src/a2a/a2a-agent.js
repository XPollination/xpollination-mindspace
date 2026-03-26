#!/usr/bin/env node
/**
 * A2A Agent — connects to mindspace A2A, receives SSE events, routes to Claude
 * Usage: node src/a2a/a2a-agent.js --role dev --api-key <key>
 *
 * Replaces tmux-based agent management with A2A-native event loop.
 */

import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    role: { type: 'string', default: 'dev' },
    'api-key': { type: 'string', default: process.env.BRAIN_API_KEY || '' },
    'api-url': { type: 'string', default: process.env.MINDSPACE_API_URL || 'http://localhost:3100' },
    name: { type: 'string' },
    project: { type: 'string', default: 'xpollination-mindspace' },
  },
});

const API_URL = args['api-url'];
const ROLE = args.role;
const API_KEY = args['api-key'];
const AGENT_NAME = args.name || `${ROLE}-agent`;
const PROJECT = args.project;

let agentId = null;
let sessionToken = null;
let eventSource = null;

async function connect() {
  console.log(`[A2A] Connecting as ${AGENT_NAME} (role: ${ROLE}) to ${API_URL}...`);

  const res = await fetch(`${API_URL}/a2a/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: { agent_name: AGENT_NAME, api_key: API_KEY },
      role: { current: ROLE, capabilities: [ROLE] },
      project: { slug: PROJECT },
      state: { status: 'active' },
      metadata: { client: 'a2a-agent.js', version: '1.0.0' },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Connect failed: ${err.error || res.statusText}`);
  }

  const data = await res.json();
  agentId = data.agent_id;
  sessionToken = data.session_token;

  console.log(`[A2A] Connected. agent_id=${agentId}`);
  console.log(`[A2A] Session token: ${sessionToken?.slice(0, 20)}...`);
  console.log(`[A2A] Stream: ${API_URL}/a2a/stream/${agentId}`);

  return data;
}

function startEventStream(handlers = {}) {
  if (!agentId) throw new Error('Not connected — call connect() first');

  const streamUrl = `${API_URL}/a2a/stream/${agentId}`;
  console.log(`[A2A] Opening SSE stream: ${streamUrl}`);

  // Node.js doesn't have native EventSource — use fetch with streaming
  return new Promise((resolve, reject) => {
    fetch(streamUrl, {
      headers: { 'Authorization': `Bearer ${sessionToken}` },
    }).then(res => {
      if (!res.ok) { reject(new Error(`Stream failed: ${res.statusText}`)); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processChunk() {
        reader.read().then(({ done, value }) => {
          if (done) { console.log('[A2A] Stream closed'); resolve(); return; }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'message';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentData) {
              // Dispatch event
              try {
                const parsed = JSON.parse(currentData);
                const handler = handlers[currentEvent] || handlers.default;
                if (handler) handler(currentEvent, parsed);
                else console.log(`[SSE] ${currentEvent}: ${JSON.stringify(parsed).slice(0, 100)}`);
              } catch { /* not JSON */ }
              currentData = '';
              currentEvent = 'message';
            }
          }

          processChunk();
        }).catch(err => { console.error('[A2A] Stream error:', err.message); reject(err); });
      }

      processChunk();
    }).catch(reject);
  });
}

async function sendMessage(type, payload = {}) {
  const res = await fetch(`${API_URL}/a2a/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ type, agent_id: agentId, ...payload }),
  });
  return res.json();
}

async function heartbeat() {
  return sendMessage('HEARTBEAT');
}

// Export for use as module
export { connect, startEventStream, sendMessage, heartbeat };
export { agentId, sessionToken, ROLE, AGENT_NAME, PROJECT, API_URL };

// CLI entry point
if (process.argv[1]?.endsWith('a2a-agent.js')) {
  (async () => {
    try {
      await connect();

      // Start heartbeat interval
      setInterval(() => heartbeat().catch(() => {}), 25000);

      // Start event stream with default handler
      await startEventStream({
        task_assigned: (_, data) => console.log(`[TASK] Assigned: ${data.task_slug} (${data.title})`),
        approval_needed: (_, data) => console.log(`[APPROVAL] ${data.task_slug}: ${data.title}`),
        review_needed: (_, data) => console.log(`[REVIEW] ${data.task_slug}: ${data.title}`),
        rework_needed: (_, data) => console.log(`[REWORK] ${data.task_slug}: ${data.title}`),
        task_blocked: (_, data) => console.log(`[BLOCKED] ${data.task_slug}: ${data.blocked_reason}`),
        transition: (_, data) => console.log(`[TRANSITION] ${data.task_slug}: ${data.from_status} → ${data.to_status}`),
        connected: () => console.log('[SSE] Connected to event stream'),
        default: (event, data) => console.log(`[${event}] ${JSON.stringify(data).slice(0, 120)}`),
      });
    } catch (err) {
      console.error('[A2A] Fatal:', err.message);
      process.exit(1);
    }
  })();
}
