#!/usr/bin/env node
/**
 * xpo-agent v2 — Thin A2A Body
 *
 * Three responsibilities only:
 *   1. Connect to Hive via A2A (Ed25519 device key)
 *   2. Listen for SSE events (task assignments)
 *   3. Trigger skill in Claude Code when task arrives
 *
 * All data access (queries, brain, delivery) goes through MCP tools.
 * The body does NOT parse pane content, markers, or agent output.
 * The body does NOT paste data — only a skill trigger (~50 bytes).
 *
 * Usage:
 *   node src/a2a/xpo-agent.js --role dev --key ~/.xp0/keys/beta.json --session a2a-team:0.2
 */

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// --- CLI Args ---

const { values: args } = parseArgs({
  options: {
    role:        { type: 'string', default: 'dev' },
    project:     { type: 'string', default: 'xpollination-mindspace' },
    api:         { type: 'string' },
    workspace:   { type: 'string', default: process.cwd() },
    interactive: { type: 'boolean', default: false },
    session:     { type: 'string' },
    key:         { type: 'string' },
  },
});

const ROLE    = args.role;
const PROJECT = args.project;
const SESSION = args.session || `runner-${ROLE}-${randomUUID().slice(0, 8)}`;

// --- Device Key ---

let deviceKey = null;
if (args.key) {
  try {
    deviceKey = JSON.parse(readFileSync(args.key, 'utf-8'));
    console.log(`[BODY] Device key: ${deviceKey.key_id}`);
  } catch (err) {
    console.error(`[BODY] Cannot read key: ${args.key} — ${err.message}`);
    process.exit(1);
  }
}

let API_URL = deviceKey?.server?.startsWith('http') ? deviceKey.server
  : args.api || 'http://localhost:3101';

// --- State (trivial: IDLE or BUSY) ---

let agentId = null;
let sessionToken = null;
let bodyState = 'IDLE';
let reconnectDelay = 5000;
const MAX_RECONNECT = 30000;

function writeStatus(fields) {
  try {
    const file = `/tmp/xpo-agent-${ROLE}.status`;
    let current = {};
    try { current = JSON.parse(readFileSync(file, 'utf-8')); } catch {}
    writeFileSync(file, JSON.stringify({ ...current, ...fields, updated_at: new Date().toISOString() }));
  } catch {}
}

// --- A2A Connect (Ed25519 challenge-response) ---

async function connectToA2A() {
  const headers = { 'Content-Type': 'application/json' };
  const identity = { agent_name: `xpo-body-${ROLE}-${randomUUID().slice(0, 8)}` };
  const body = {
    identity,
    role: { current: ROLE },
    project: { slug: PROJECT },
    state: { status: 'active' },
    metadata: { client: 'xpo-agent-v2', interactive: args.interactive },
  };

  let data;
  if (deviceKey) {
    body.identity.key_id = deviceKey.key_id;
    const res = await fetch(`${API_URL}/a2a/connect`, { method: 'POST', headers, body: JSON.stringify(body) });
    data = await res.json();

    if (data.type === 'CHALLENGE') {
      const privateKey = createPrivateKey(deviceKey.private_key);
      const nonce = Buffer.from(data.nonce, 'base64');
      const signature = sign(null, nonce, privateKey);
      body.challenge_response = { signature: signature.toString('base64') };
      const authRes = await fetch(`${API_URL}/a2a/connect`, { method: 'POST', headers, body: JSON.stringify(body) });
      data = await authRes.json();
    }
  } else {
    throw new Error('Device key required');
  }

  if (data.type === 'ERROR') throw new Error(`A2A: ${data.error}`);

  agentId = data.agent_id;
  sessionToken = data.session_token;
  reconnectDelay = 5000;

  // Service discovery
  if (data.services?.hive && data.services.hive !== API_URL) {
    console.log(`[BODY] Hive URL: ${API_URL} → ${data.services.hive}`);
    API_URL = data.services.hive;
  }

  console.log(`[BODY] Connected. agent=${agentId} role=${ROLE}`);

  // Write env for tools (MCP tools may need the API URL)
  writeFileSync(`/tmp/xpo-agent-${ROLE}.env`, `A2A_API_URL=${API_URL}\nA2A_AGENT_ID=${agentId}\nA2A_TOKEN=${sessionToken}\n`);
  try { chmodSync(`/tmp/xpo-agent-${ROLE}.env`, 0o600); } catch {}
  writeStatus({ connected: true, agent_id: agentId, body_state: bodyState });
}

// --- A2A Message Helper ---

async function a2aMessage(body) {
  const res = await fetch(`${API_URL}/a2a/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
    body: JSON.stringify({ ...body, agent_id: agentId }),
  });
  return res.json();
}

// --- Skill Trigger (the ONLY paste — ~50 bytes) ---

function triggerSkill(slug) {
  const cmd = `/xpo.${ROLE}.startTask ${slug}`;
  try {
    execFileSync('tmux', ['send-keys', '-t', SESSION, cmd, 'Enter'], { timeout: 5000 });
    console.log(`[BODY] Triggered: ${cmd}`);
    bodyState = 'BUSY';
    writeStatus({ body_state: 'BUSY', current_task: slug });
  } catch (err) {
    console.error(`[BODY] Skill trigger failed: ${err.message}`);
  }
}

// --- Idle Detection (minimal — just checks ❯ to know when BUSY→IDLE) ---

function paneHasIdlePrompt(text) {
  return text.split('\n').some(l => l.startsWith('❯') || l.startsWith('> '));
}

let idleTimer = null;
function startIdleDetection() {
  if (idleTimer) clearInterval(idleTimer);
  idleTimer = setInterval(() => {
    if (bodyState !== 'BUSY') return;
    try {
      const capture = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p', '-S', '-5'], { stdio: 'pipe' }).toString();
      if (paneHasIdlePrompt(capture)) {
        bodyState = 'IDLE';
        writeStatus({ body_state: 'IDLE', current_task: null });
        console.log('[BODY] Agent idle — ready for next task');
      }
    } catch {}
  }, 30000);
}

// --- SSE Event Handling ---

async function handleEvent(eventType, data) {
  writeStatus({ last_event: new Date().toISOString(), last_event_type: eventType });

  if (eventType === 'revoked') {
    console.log('[BODY] Device key REVOKED. Shutting down.');
    writeStatus({ connected: false, body_state: 'revoked' });
    process.exit(0);
  }

  const taskEvents = ['task_available', 'task_assigned', 'approval_needed', 'review_needed', 'rework_needed'];
  if (taskEvents.includes(eventType)) {
    console.log(`[BODY] ${eventType}: ${data.task_slug || ''} (state: ${bodyState})`);

    if (bodyState !== 'IDLE') {
      console.log(`[BODY] Busy — ignoring (will query fresh when idle)`);
      return;
    }

    // Negotiate: claim the task
    try {
      const result = await a2aMessage({ type: 'CLAIM_TASK', task_slug: data.task_slug });
      if (result.type === 'CLAIM_CONFIRMED') {
        triggerSkill(data.task_slug);
      } else {
        console.log(`[BODY] Claim rejected: ${result.error || result.type}`);
      }
    } catch (err) {
      console.error(`[BODY] Claim failed: ${err.message}`);
    }
  }
}

// --- SSE Stream ---

async function listenForEvents() {
  const url = `${API_URL}/a2a/stream/${agentId}`;
  console.log(`[BODY] SSE: ${url}`);
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${sessionToken}` } });
  if (!res.ok) throw new Error(`SSE ${res.status}`);
  writeStatus({ sse: 'open' });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('SSE closed');
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
      else if (line.startsWith('data: ') && currentEvent) {
        try { handleEvent(currentEvent, JSON.parse(line.slice(6))); } catch {}
        currentEvent = '';
      }
    }
  }
}

// --- Heartbeat ---

async function heartbeatLoop() {
  while (true) {
    await new Promise(r => setTimeout(r, 25000));
    try {
      await fetch(`${API_URL}/api/agents/${agentId}/heartbeat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
    } catch {}
  }
}

// --- LLM Ready Detection ---

async function waitForLlm() {
  console.log('[BODY] Waiting for LLM...');
  let elapsed = 0;
  while (true) {
    try {
      const pane = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p', '-S', '-10'], { stdio: 'pipe' }).toString();
      if (pane.split('\n').some(l => l.startsWith('❯'))) {
        console.log(`[BODY] LLM ready (${elapsed}s)`);
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
    elapsed += 2;
    if (elapsed % 30 === 0) console.log(`[BODY] Still waiting... (${elapsed}s)`);
  }
}

// --- Shutdown ---

function registerShutdown() {
  const cleanup = () => {
    console.log('[BODY] Shutting down...');
    if (idleTimer) clearInterval(idleTimer);
    writeStatus({ connected: false, body_state: 'stopped' });
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// --- Main ---

async function main() {
  console.log(`
╔══════════════════════════════════════╗
║  xpo-agent v2 — Thin A2A Body       ║
╠══════════════════════════════════════╣
║  Role:    ${ROLE.padEnd(27)}║
║  Session: ${SESSION.padEnd(27)}║
║  API:     ${API_URL.padEnd(27)}║
╚══════════════════════════════════════╝`);

  registerShutdown();
  await connectToA2A();

  // Wait for LLM, then start
  (async () => {
    await waitForLlm();
    console.log('[BODY] Ready — listening for tasks');
    startIdleDetection();

    // Check for pending tasks on startup (proactive)
    try {
      const data = await a2aMessage({
        type: 'OBJECT_QUERY', object_type: 'task',
        filters: { current_role: ROLE, status: 'ready' },
      });
      const tasks = data.objects || [];
      if (tasks.length > 0) {
        console.log(`[BODY] ${tasks.length} ready task(s) — claiming first`);
        const result = await a2aMessage({ type: 'CLAIM_TASK', task_slug: tasks[0].slug });
        if (result.type === 'CLAIM_CONFIRMED') triggerSkill(tasks[0].slug);
      }
    } catch (err) {
      console.error(`[BODY] Startup query failed: ${err.message}`);
    }
  })().catch(err => console.error(`[BODY] LLM init failed: ${err.message}`));

  // SSE loop (reconnects)
  while (true) {
    try {
      heartbeatLoop().catch(() => {});
      await listenForEvents();
    } catch (err) {
      console.error(`[BODY] ${err.message}. Reconnecting in ${reconnectDelay / 1000}s...`);
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT);
      try { await connectToA2A(); } catch {}
    }
  }
}

main();
