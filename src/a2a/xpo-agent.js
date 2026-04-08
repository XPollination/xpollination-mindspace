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
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

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
  },
});

const ROLE        = args.role;
const PROJECT     = args.project;
const API_URL     = args.api;
const API_KEY     = args['api-key'];
const WORKSPACE   = resolve(args.workspace);
const LLM         = args.llm;
const INTERACTIVE = args.interactive;
const SHORT_ID    = randomUUID().slice(0, 8);
const SESSION     = args.session || args.name || `runner-${ROLE}-${SHORT_ID}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DELIVER_SCRIPT = resolve(__dirname, '../../scripts/a2a-deliver.js');

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

  if (!API_KEY) {
    console.error('[AGENT] No API key. Set BRAIN_API_KEY or use --api-key');
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

## Identity
- Role: ${ROLE}
- Session: ${SESSION}
- A2A Server: ${API_URL}
- Project: ${PROJECT}

## Communication — A2A Protocol
The SSE bridge delivers task events to you as [TASK] messages.

When you receive a [TASK], do the work described. When done, deliver results:

  node ${DELIVER_SCRIPT} --slug <TASK_SLUG> --transition <STATUS> --role ${ROLE} --api-url ${API_URL} --api-key ${API_KEY}

Add --findings "..." or --implementation "..." to include your work output.

## Workspace
Working directory: ${WORKSPACE}
Git is available. Commit and push your changes following the git protocol.`;
}

// --- A2A Connection ---

async function connectToA2A() {
  const res = await fetch(`${API_URL}/a2a/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: { agent_name: `xpo-agent-${ROLE}-${SHORT_ID}`, api_key: API_KEY },
      role: { current: ROLE, capabilities: [ROLE] },
      project: { slug: PROJECT },
      state: { status: 'active' },
      metadata: { client: 'xpo-agent', version: '1.0.0', session: SESSION, workspace: WORKSPACE },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`A2A connect failed: ${err}`);
  }

  const data = await res.json();
  if (data.type === 'ERROR') throw new Error(`A2A error: ${data.error}`);

  agentId = data.agent_id;
  sessionToken = data.session_token;
  reconnectDelay = 5000;
  console.log(`[AGENT] Connected. agent_id=${agentId}`);
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

  if (actionableEvents.includes(eventType)) {
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

  const deliverCmd = `node ${DELIVER_SCRIPT} --slug ${slug} --transition ${nextStatus} --role ${ROLE} --api-url ${API_URL} --api-key ${API_KEY}`;
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

  // Connect + listen loop with reconnect
  while (true) {
    try {
      await connectToA2A();
      startHeartbeatLoop().catch(() => {});
      await listenForEvents();
    } catch (err) {
      console.error(`[AGENT] ${err.message}. Reconnecting in ${reconnectDelay / 1000}s...`);
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }
  }
}

main();
