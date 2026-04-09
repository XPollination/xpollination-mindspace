#!/usr/bin/env node
/**
 * xpo-agent — A2A Agent Body
 *
 * Separates brain (LLM) from body (A2A protocol).
 * Connects to A2A, opens SSE stream, launches any LLM in tmux,
 * bridges events to the LLM's terminal.
 *
 * The LLM runs on the host with full workspace access.
 * The body handles identity, protocol, and event delivery.
 *
 * Usage:
 *   node src/a2a/xpo-agent.js --role dev --project xpollination-mindspace
 *   node src/a2a/xpo-agent.js --role pdsa --api http://remote:3101 --workspace ~/project
 *   node src/a2a/xpo-agent.js --role qa --llm ollama
 *
 * Interactive mode (LIAISON — Claude in foreground, body in background):
 *   node src/a2a/xpo-agent.js --role liaison --interactive --session my-session
 */

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

// --- CLI Args ---

const { values: args } = parseArgs({
  options: {
    role:        { type: 'string', default: 'dev' },
    project:     { type: 'string', default: 'xpollination-mindspace' },
    api:         { type: 'string', default: process.env.MINDSPACE_API_URL || 'http://localhost:3101' },
    'api-key':   { type: 'string', default: process.env.BRAIN_API_KEY || process.env.BRAIN_AGENT_KEY || '' },
    workspace:   { type: 'string', default: process.cwd() },
    llm:         { type: 'string', default: 'claude' },
    name:        { type: 'string' },
    interactive: { type: 'boolean', default: false },
    session:     { type: 'string' },
    token:       { type: 'string' },
    key:         { type: 'string' },  // path to ~/.xp0/keys/<server>.json
  },
});

const ROLE        = args.role;
const PROJECT     = args.project;
const API_URL     = args.api;
const API_KEY     = args['api-key'];
const JWT_TOKEN   = args.token;  // OAuth device flow JWT — fallback
const KEY_FILE    = args.key;    // Ed25519 device key — preferred

// Load device key if provided
let deviceKey = null;
if (KEY_FILE) {
  try {
    deviceKey = JSON.parse(readFileSync(KEY_FILE, 'utf-8'));
    console.log(`[AGENT] Using device key: ${deviceKey.key_id}`);
  } catch (err) {
    console.error(`[AGENT] Cannot read key file: ${KEY_FILE} — ${err.message}`);
    process.exit(1);
  }
}
const WORKSPACE   = resolve(args.workspace);
const LLM         = args.llm;
const INTERACTIVE = args.interactive;
const SHORT_ID    = randomUUID().slice(0, 8);
const SESSION     = args.session || args.name || `runner-${ROLE}-${SHORT_ID}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DELIVER_SCRIPT = resolve(__dirname, '../../scripts/a2a-deliver.js');
const BRAIN_URL  = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_SESSION = randomUUID();

// --- State ---

let agentId = null;
let sessionToken = null;
let reconnectDelay = 5000;
const MAX_RECONNECT_DELAY = 30000;

// --- Prerequisites ---

function verifyPrerequisites() {
  try {
    execFileSync('tmux', ['-V'], { stdio: 'pipe' });
  } catch {
    console.error('[AGENT] tmux is not installed');
    process.exit(1);
  }

  if (!existsSync(WORKSPACE)) {
    console.error(`[AGENT] Workspace does not exist: ${WORKSPACE}`);
    process.exit(1);
  }

  if (!existsSync(DELIVER_SCRIPT)) {
    console.error(`[AGENT] Deliver script not found: ${DELIVER_SCRIPT}`);
    console.error('        Run from the xpollination-mindspace repo root.');
    process.exit(1);
  }

  if (!deviceKey && !API_KEY && !JWT_TOKEN) {
    console.error('[AGENT] No auth. Use --key (device key), --token (JWT), or --api-key');
    process.exit(1);
  }
}

// --- Tmux Session ---

function createTmuxSession() {
  if (INTERACTIVE) {
    // Interactive mode: the LLM session is the CURRENT tmux pane.
    // We don't create a new session — we deliver events to SESSION (which must exist).
    try {
      execFileSync('tmux', ['has-session', '-t', SESSION], { stdio: 'pipe' });
      console.log(`[AGENT] Interactive mode: delivering events to ${SESSION}`);
    } catch {
      console.error(`[AGENT] Interactive mode requires an existing tmux session: ${SESSION}`);
      process.exit(1);
    }
    return;
  }

  // Standard mode: create a new tmux session for the LLM
  try {
    execFileSync('tmux', ['has-session', '-t', SESSION], { stdio: 'pipe' });
    console.log(`[AGENT] Reusing tmux session: ${SESSION}`);
    return;
  } catch { /* does not exist */ }

  execFileSync('tmux', ['new-session', '-d', '-s', SESSION, '-x', '200', '-y', '50']);

  const llmCmd = buildLlmCommand();
  execFileSync('tmux', ['send-keys', '-t', SESSION, llmCmd, 'Enter']);
  console.log(`[AGENT] Created tmux session: ${SESSION}`);
}

function buildLlmCommand() {
  const prompt = buildSystemPrompt();

  if (LLM === 'claude') {
    const escaped = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    return `cd "${WORKSPACE}" && claude --append-system-prompt "${escaped}"`;
  }

  // Generic LLM — just cd and launch, deliver system prompt via send-keys after
  return `cd "${WORKSPACE}" && ${LLM}`;
}

function buildSystemPrompt() {
  return `You are the ${ROLE.toUpperCase()} agent in XPollination Mindspace.

## A2A Commands
When you receive a [TASK], do the work described. When done, deliver results:
  node ${DELIVER_SCRIPT} --slug <TASK_SLUG> --transition <STATUS> --role ${ROLE}
Add --findings "..." or --implementation "..." to include your work output.

Do NOT use curl to call A2A endpoints directly. All A2A communication goes through a2a-deliver.js.

## Workspace
Working directory: ${WORKSPACE}
Git is available. Commit and push your changes following the git protocol.`;
}

// --- Startup: Wait for LLM ---

function waitForLlmReady(maxWait = 30) {
  console.log(`[AGENT] Waiting for LLM to be ready...`);
  const target = LLM === 'claude' ? 'claude' : LLM;
  for (let i = 0; i < maxWait; i++) {
    try {
      const cmd = execFileSync('tmux', ['display-message', '-t', SESSION, '-p', '#{pane_current_command}'], { stdio: 'pipe' }).toString().trim();
      if (cmd === target || cmd === 'claude') {
        console.log(`[AGENT] LLM ready (${cmd}, ${i}s)`);
        return true;
      }
    } catch { /* pane may not exist yet */ }
    execFileSync('sleep', ['1']);
  }
  console.warn(`[AGENT] LLM not detected after ${maxWait}s — proceeding anyway`);
  return false;
}

// --- Startup: Prompt Sequence ---

async function sendStartupPrompts() {
  console.log('[AGENT] Starting brain-first recovery...');

  // PROMPT 1: Brain recovery — LLM reads its role definition from brain
  await sendPromptAndWait(buildBrainRecoveryPrompt());

  // PROMPT 2: Approval mode (LIAISON only)
  if (ROLE === 'liaison') {
    await sendPromptAndWait(buildApprovalModePrompt());
  }

  // PROMPT 3: Task state — LLM queries A2A for current tasks
  await sendPromptAndWait(buildTaskStatePrompt());

  // PROMPT 4: Ready confirmation
  await sendPromptAndWait('Confirm you are ready. State: (1) your role and key boundaries, (2) number of tasks assigned to you, (3) READY. The A2A event stream will start delivering [TASK] messages after you confirm.');

  // Wait for READY signal
  await waitForReadySignal();
  console.log('[AGENT] Handshake complete — starting event stream');
}

function buildBrainRecoveryPrompt() {
  const curlCmd = `curl -s -X POST ${BRAIN_URL}/api/v1/memory -H 'Content-Type: application/json' -H 'Authorization: Bearer ${API_KEY}' -d '{"prompt":"Recovery protocol and role definition for ${ROLE} agent. What are my responsibilities, boundaries, and latest operational learnings?","agent_id":"agent-${ROLE}","agent_name":"${ROLE.toUpperCase()}","session_id":"${BRAIN_SESSION}","read_only":true}'`;

  return `You are the ${ROLE.toUpperCase()} agent. Before doing anything, recover your role definition from the shared brain. Run this command and read the result carefully — it defines who you are and what you must never do:\n\n${curlCmd}`;
}

function buildApprovalModePrompt() {
  return `Check your approval mode. Run: curl -s ${API_URL}/api/settings/liaison-approval-mode

Modes:
- autonomous: You decide immediately. Document reasoning in liaison_reasoning. Do NOT ask Thomas. Do NOT wait. The mode IS the answer. You also drive the pipeline proactively.
- semi: Present full task details. STOP. Wait for Thomas to type his decision. Do NOT proceed until he responds.
- manual: Present details. Tell Thomas to click Confirm in the viz UI. STOP.
- auto-approval: Same as autonomous for approval transitions. Thomas decides on completions.

CRITICAL: Check mode BEFORE every decision transition. Thomas can change it at any time. Never cache.`;
}

function buildTaskStatePrompt() {
  return `Query your current tasks. Run: curl -s -X POST ${API_URL}/a2a/message -H 'Content-Type: application/json' -d '{"agent_id":"${agentId}","type":"OBJECT_QUERY","object_type":"task","filters":{"current_role":"${ROLE}"}}'

Report: how many tasks are assigned to you and their statuses.`;
}

async function sendPromptAndWait(prompt, maxWait = 90) {
  deliverToTmux(prompt);

  // Wait for LLM to process — detect idle prompt (❯)
  for (let i = 0; i < maxWait; i += 2) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const capture = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p', '-S', '-5'], { stdio: 'pipe' }).toString();
      const lines = capture.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1] || '';
      // Claude's idle prompt starts with ❯
      if (lastLine.startsWith('❯') || lastLine.startsWith('> ')) {
        return;
      }
    } catch { /* capture may fail */ }
  }
  console.warn(`[AGENT] Prompt may not have been processed within ${maxWait}s`);
}

async function waitForReadySignal(maxWait = 60) {
  for (let i = 0; i < maxWait; i += 2) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const capture = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p', '-S', '-10'], { stdio: 'pipe' }).toString();
      if (capture.includes('READY')) {
        return true;
      }
    } catch { /* capture may fail */ }
  }
  console.warn('[AGENT] READY signal not detected — proceeding anyway');
  return false;
}

// --- A2A Connection ---

async function connectToA2A() {
  const headers = { 'Content-Type': 'application/json' };
  const identity = { agent_name: `xpo-agent-${ROLE}-${SHORT_ID}` };
  const twinBody = {
    identity,
    role: { current: ROLE, capabilities: [ROLE] },
    project: { slug: PROJECT },
    state: { status: 'active' },
    metadata: { client: 'xpo-agent', version: '2.1.0', session: SESSION, workspace: WORKSPACE },
  };

  let data;

  if (deviceKey) {
    // Ed25519 challenge-response (persistent device key)
    // Step 1: Request challenge
    identity.key_id = deviceKey.key_id;
    const challengeRes = await fetch(`${API_URL}/a2a/connect`, {
      method: 'POST', headers,
      body: JSON.stringify(twinBody),
    });
    if (!challengeRes.ok) {
      const err = await challengeRes.text();
      throw new Error(`A2A connect failed: ${err}`);
    }
    const challengeData = await challengeRes.json();
    if (challengeData.type === 'ERROR') throw new Error(`A2A error: ${challengeData.error}`);
    if (challengeData.type !== 'CHALLENGE') throw new Error(`Expected CHALLENGE, got ${challengeData.type}`);

    // Step 2: Sign nonce with private key
    const privKey = createPrivateKey(deviceKey.private_key);
    const nonce = Buffer.from(challengeData.challenge, 'base64');
    const signature = sign(null, nonce, privKey);
    identity.signature = signature.toString('base64');

    // Step 3: Send signature for verification
    const verifyRes = await fetch(`${API_URL}/a2a/connect`, {
      method: 'POST', headers,
      body: JSON.stringify(twinBody),
    });
    if (!verifyRes.ok) {
      const err = await verifyRes.text();
      throw new Error(`A2A verify failed: ${err}`);
    }
    data = await verifyRes.json();
  } else if (JWT_TOKEN) {
    // OAuth device flow JWT (24h fallback)
    headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
    const res = await fetch(`${API_URL}/a2a/connect`, {
      method: 'POST', headers,
      body: JSON.stringify(twinBody),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`A2A connect failed: ${err}`);
    }
    data = await res.json();
  } else if (API_KEY) {
    // Legacy API key
    identity.api_key = API_KEY;
    const res = await fetch(`${API_URL}/a2a/connect`, {
      method: 'POST', headers,
      body: JSON.stringify(twinBody),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`A2A connect failed: ${err}`);
    }
    data = await res.json();
  }

  if (data.type === 'ERROR') throw new Error(`A2A error: ${data.error}`);

  agentId = data.agent_id;
  sessionToken = data.session_token;
  reconnectDelay = 5000;
  console.log(`[AGENT] Connected. agent_id=${agentId}`);

  // Write credentials file for a2a-deliver.js
  const envFile = `/tmp/xpo-agent-${ROLE}.env`;
  const envContent = deviceKey
    ? `A2A_API_URL=${API_URL}\nA2A_KEY_FILE=${KEY_FILE}\nA2A_AGENT_ID=${agentId}\n`
    : JWT_TOKEN
      ? `A2A_API_URL=${API_URL}\nA2A_TOKEN=${JWT_TOKEN}\nA2A_AGENT_ID=${agentId}\n`
      : `A2A_API_URL=${API_URL}\nA2A_API_KEY=${API_KEY}\nA2A_AGENT_ID=${agentId}\n`;
  writeFileSync(envFile, envContent);
  try { chmodSync(envFile, 0o600); } catch { /* best effort */ }
}

// --- SSE Event Stream ---

async function listenForEvents() {
  const streamUrl = `${API_URL}/a2a/stream/${agentId}`;
  console.log(`[AGENT] Opening SSE: ${streamUrl}`);

  const res = await fetch(streamUrl, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  });

  if (!res.ok) throw new Error(`SSE stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('SSE stream closed');

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          handleEvent(currentEvent, JSON.parse(line.slice(6)));
        } catch { /* parse error */ }
        currentEvent = '';
      }
      // SSE comments (: keepalive) — ignore
    }
  }
}

// --- Event Handling ---

function handleEvent(eventType, data) {
  const actionableEvents = ['task_available', 'task_assigned', 'approval_needed', 'review_needed', 'rework_needed'];

  if (eventType === 'revoked') {
    console.log('[AGENT] Device key REVOKED by user. Disconnecting.');
    deliverToTmux('[A2A] Session revoked. Run claude-session to reconnect with a new key.');
    process.exit(0);
  } else if (actionableEvents.includes(eventType)) {
    console.log(`[AGENT] ${eventType}: ${data.task_slug || ''}`);
    deliverToTmux(buildInstruction(eventType, data));
  } else if (eventType === 'connected') {
    console.log(`[AGENT] SSE connected`);
  }
}

function buildInstruction(eventType, data) {
  const slug = data.task_slug || '';
  const title = data.title || '';

  const transitionMap = {
    task_available:  { pdsa: 'approval', dev: 'review', qa: 'review', liaison: 'review' },
    task_assigned:   { pdsa: 'approval', dev: 'review', qa: 'review', liaison: 'review' },
    approval_needed: { liaison: 'approved' },
    review_needed:   { qa: 'review', pdsa: 'review', liaison: 'complete' },
    rework_needed:   { pdsa: 'approval', dev: 'review', qa: 'review' },
  };
  const nextStatus = transitionMap[eventType]?.[ROLE] || 'review';

  const instructions = {
    task_available:  'Do the work described.',
    task_assigned:   'Do the work described.',
    approval_needed: 'Review this and approve or reject.',
    review_needed:   'Review the work. If it passes, forward it.',
    rework_needed:   `Fix the issues: ${data.rework_reason || 'see task DNA'}.`,
  };
  const instruction = instructions[eventType] || 'Process this task.';

  const deliverCmd = `node ${DELIVER_SCRIPT} --slug ${slug} --transition ${nextStatus} --role ${ROLE}`;
  const context = data.dna?.description?.substring(0, 150) || title;

  return `[TASK] ${slug} — ${title}. Role: ${ROLE}. ${instruction} Context: ${context}. When done: ${deliverCmd}`;
}

function deliverToTmux(message) {
  try {
    execFileSync('tmux', ['send-keys', '-t', SESSION, message, 'Enter'], { timeout: 5000 });
    console.log(`[AGENT] Delivered to ${SESSION}`);
  } catch (err) {
    console.error(`[AGENT] tmux delivery failed: ${err.message}`);
  }
}

// --- Heartbeat ---

async function startHeartbeatLoop() {
  while (true) {
    await new Promise(r => setTimeout(r, 25000));
    if (!agentId) continue;
    try {
      await fetch(`${API_URL}/a2a/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
        body: JSON.stringify({ type: 'HEARTBEAT', agent_id: agentId }),
      });
    } catch { /* best effort */ }
  }
}

// --- Shutdown ---

function registerShutdownHandlers() {
  const cleanup = async () => {
    console.log('\n[AGENT] Shutting down...');

    if (agentId) {
      try {
        await fetch(`${API_URL}/a2a/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'DISCONNECT', agent_id: agentId }),
        });
        console.log('[AGENT] Disconnected from A2A');
      } catch { /* best effort */ }
    }

    if (!INTERACTIVE) {
      try {
        execFileSync('tmux', ['kill-session', '-t', SESSION], { stdio: 'pipe' });
        console.log(`[AGENT] Killed tmux session: ${SESSION}`);
      } catch { /* already gone */ }
    }

    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// --- Main ---

async function main() {
  console.log(`
╔══════════════════════════════════════╗
║  xpo-agent — A2A Agent Body         ║
╠══════════════════════════════════════╣
║  Role:      ${ROLE.padEnd(25)}║
║  Project:   ${PROJECT.padEnd(25)}║
║  API:       ${API_URL.padEnd(25)}║
║  Workspace: ${WORKSPACE.slice(-25).padEnd(25)}║
║  LLM:       ${LLM.padEnd(25)}║
║  Session:   ${SESSION.padEnd(25)}║
╚══════════════════════════════════════╝
`);

  verifyPrerequisites();
  createTmuxSession();
  registerShutdownHandlers();

  // Step 1: Wait for LLM to be ready at prompt
  waitForLlmReady();

  // Step 2: Connect to A2A (need agent_id for task state prompt)
  await connectToA2A();

  // Step 3: Brain-first startup — send prompts, wait for handshake
  await sendStartupPrompts();

  // Step 4: SSE event loop — only after handshake
  while (true) {
    try {
      startHeartbeatLoop().catch(() => {});
      await listenForEvents();
    } catch (err) {
      console.error(`[AGENT] ${err.message}. Reconnecting in ${reconnectDelay / 1000}s...`);
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      // Reconnect A2A on stream failure
      try { await connectToA2A(); } catch { /* will retry in next loop */ }
    }
  }
}

main();
