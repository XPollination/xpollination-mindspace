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
    api:         { type: 'string' },  // optional override — normally read from key file
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

// API URL resolution — single source of truth chain:
//   1. Key file's server field (captured at registration, locked to that environment)
//   2. --api CLI arg (override only for first-time bootstrap before key exists)
//   3. Hard error — no env var defaults, no silent drift
function resolveApiUrl() {
  if (deviceKey?.server) {
    // Modern format: server is the full URL (http://... or https://...)
    if (deviceKey.server.startsWith('http')) return deviceKey.server;
    // Legacy format: server is just a hostname — convert
    if (deviceKey.server === 'localhost') return 'http://localhost:3101';
    return `https://${deviceKey.server}/api`;
  }
  if (args.api) return args.api;
  console.error('[AGENT] No API URL: provide --key (with server) or --api for bootstrap');
  process.exit(1);
}
// Bootstrap URL — used only for the very first /a2a/connect call.
// After WELCOME, we switch to the canonical URL advertised by A2A (services.hive).
// This lets operators migrate the API host without touching any body config.
let API_URL = resolveApiUrl();
console.log(`[AGENT] Bootstrap API URL: ${API_URL} (will switch to canonical from WELCOME)`);

const WORKSPACE   = resolve(args.workspace);
const LLM         = args.llm;
const INTERACTIVE = args.interactive;
const SHORT_ID    = randomUUID().slice(0, 8);
const SESSION     = args.session || args.name || `runner-${ROLE}-${SHORT_ID}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const DELIVER_SCRIPT = resolve(__dirname, '../../scripts/a2a-deliver.js');
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

/**
 * Poll pane until LLM is ready. Two detection methods:
 * 1. pane_current_command matches LLM (works when launched via exec)
 * 2. pane content shows the Claude UI signature (works when launched via wrapper script)
 * No timeout — keeps checking until found.
 */
async function waitForLlmReady() {
  console.log(`[AGENT] Polling for LLM...`);
  const target = LLM === 'claude' ? 'claude' : LLM;
  let elapsed = 0;
  while (true) {
    try {
      // Method 1: process name
      const cmd = execFileSync('tmux', ['display-message', '-t', SESSION, '-p', '#{pane_current_command}'], { stdio: 'pipe' }).toString().trim();
      if (cmd === target || cmd === 'claude') {
        console.log(`[AGENT] LLM ready (${cmd}, ${elapsed}s)`);
        return;
      }
      // Method 2: pane content signature (Claude UI markers)
      const pane = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p'], { stdio: 'pipe' }).toString();
      if (pane.includes('Claude Code') || pane.includes('Opus 4') || /❯\s*$/m.test(pane)) {
        console.log(`[AGENT] LLM ready (content-detected, ${elapsed}s)`);
        return;
      }
    } catch { /* pane may not exist yet */ }
    await new Promise(r => setTimeout(r, 2000));
    elapsed += 2;
    if (elapsed % 30 === 0) console.log(`[AGENT] Still waiting for LLM... (${elapsed}s)`);
  }
}

// --- A2A Queries (body queries on behalf of LLM, never the LLM itself) ---

async function queryTasksViaA2A() {
  try {
    const res = await fetch(`${API_URL}/a2a/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
      body: JSON.stringify({
        type: 'OBJECT_QUERY',
        agent_id: agentId,
        object_type: 'task',
        filters: { current_role: ROLE, status_not_in: 'complete,cancelled,blocked' },
      }),
    });
    const data = await res.json();
    return data.objects || data.result?.objects || [];
  } catch (err) {
    console.error(`[AGENT] Task query failed: ${err.message}`);
    return [];
  }
}

async function queryApprovalMode() {
  try {
    const res = await fetch(`${API_URL}/api/settings/liaison-approval-mode`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.mode || data.value || null;
  } catch (err) {
    console.error(`[AGENT] Approval mode query failed: ${err.message}`);
    return null;
  }
}

function summarizeTasks(tasks) {
  if (!tasks || tasks.length === 0) return 'No active tasks.';
  const byStatus = {};
  tasks.forEach(t => {
    const s = t.state?.status || t.status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  const counts = Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(', ');
  return `${tasks.length} active task${tasks.length === 1 ? '' : 's'}: ${counts}`;
}

// --- Brain Access via A2A ---

async function queryBrainViaA2A(prompt) {
  try {
    const res = await fetch(`${API_URL}/a2a/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
      body: JSON.stringify({
        type: 'BRAIN_QUERY',
        agent_id: agentId,
        prompt,
        read_only: true,
        full_content: true,
      }),
    });
    const data = await res.json();
    if (data.type === 'BRAIN_RESULT' && data.result?.sources?.length) {
      return data.result.sources.slice(0, 3).map(s => s.content || s.content_preview).join('\n\n');
    }
    return data.result?.response || null;
  } catch (err) {
    console.error(`[AGENT] Brain query failed: ${err.message}`);
    return null;
  }
}

// --- Startup: Single Consolidated Prompt ---

async function sendStartupPrompts() {
  console.log('[AGENT] Body querying state on behalf of LLM...');

  // Body queries everything in parallel — LLM never touches A2A directly
  const [brainContext, tasks, approvalMode] = await Promise.all([
    queryBrainViaA2A(`Current task state, recent decisions, and pending work for ${ROLE} agent. What was I working on?`),
    queryTasksViaA2A(),
    ROLE === 'liaison' ? queryApprovalMode() : Promise.resolve(null),
  ]);

  console.log(`[AGENT] Brain: ${brainContext ? 'context' : 'none'} | Tasks: ${tasks.length} | Mode: ${approvalMode || 'n/a'}`);

  // Build a single consolidated startup prompt — pure text, no commands
  const sections = [];

  if (brainContext) {
    sections.push(`[BRAIN CONTEXT]\n${brainContext}`);
  } else {
    sections.push(`[BRAIN] No prior context. Your role is in CLAUDE.md.`);
  }

  sections.push(`[TASKS] ${summarizeTasks(tasks)}`);

  if (ROLE === 'liaison' && approvalMode) {
    const modeDesc = {
      autonomous: 'You decide immediately. Document reasoning in liaison_reasoning. Do NOT ask Thomas. The mode IS the answer.',
      semi: 'Present full task details. STOP. Wait for Thomas to type his decision.',
      manual: 'Present details. Tell Thomas to click Confirm in the viz UI. STOP.',
      'auto-approval': 'Same as autonomous for approval transitions. Thomas decides on completions.',
    }[approvalMode] || 'Unknown mode — ask Thomas.';
    sections.push(`[APPROVAL MODE] ${approvalMode} — ${modeDesc}\nNote: Body re-checks this before each task. Mode can change at any time.`);
  }

  sections.push(`Confirm READY by stating: (1) your role and boundaries, (2) task count, (3) READY.`);

  await sendPromptAndWait(sections.join('\n\n'));

  // Wait for READY signal
  await waitForReadySignal();
  console.log('[AGENT] Handshake complete — starting event stream');
}

async function sendPromptAndWait(prompt, maxWait = 90) {
  await deliverToTmux(prompt);

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
    if (challengeRes.status === 401) {
      console.error('[AGENT] Device key revoked or invalid. Shutting down.');
      writeStatus({ connected: false, sse: 'revoked' });
      try { execFileSync('tmux', ['send-keys', '-t', SESSION, 'Escape'], { timeout: 3000 }); } catch {}
      setTimeout(() => {
        try { execFileSync('tmux', ['send-keys', '-t', SESSION, '/exit', 'Enter'], { timeout: 3000 }); } catch {}
        setTimeout(() => process.exit(1), 2000);
      }, 1000);
      return;
    }
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

  // Service discovery: A2A advertises the canonical hive URL we should use.
  // The hive is the public entry point for A2A — bodies use it for everything
  // after the bootstrap connect. To migrate A2A to a new host, change
  // CANONICAL_HIVE_URL on the A2A server — bodies pick it up on next connect.
  // No separate "API" — there is only A2A.
  if (data.services?.hive && data.services.hive !== API_URL) {
    console.log(`[AGENT] Switching to hive URL: ${API_URL} → ${data.services.hive}`);
    API_URL = data.services.hive;
  }
  console.log(`[AGENT] Connected. agent_id=${agentId} via ${API_URL}`);

  // Write credentials file for a2a-deliver.js
  const envFile = `/tmp/xpo-agent-${ROLE}.env`;
  const envContent = deviceKey
    ? `A2A_API_URL=${API_URL}\nA2A_KEY_FILE=${KEY_FILE}\nA2A_AGENT_ID=${agentId}\n`
    : JWT_TOKEN
      ? `A2A_API_URL=${API_URL}\nA2A_TOKEN=${JWT_TOKEN}\nA2A_AGENT_ID=${agentId}\n`
      : `A2A_API_URL=${API_URL}\nA2A_API_KEY=${API_KEY}\nA2A_AGENT_ID=${agentId}\n`;
  writeFileSync(envFile, envContent);
  try { chmodSync(envFile, 0o600); } catch { /* best effort */ }

  // Write status file for agents to verify body is alive
  writeStatus({ connected: true, agent_id: agentId, sse: 'pending', last_event: null });
}

const STATUS_FILE = `/tmp/xpo-agent-${ROLE}.status`;
function writeStatus(fields) {
  try {
    let current = {};
    try { current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8')); } catch { /* first write */ }
    const updated = { ...current, ...fields, updated_at: new Date().toISOString() };
    writeFileSync(STATUS_FILE, JSON.stringify(updated));
  } catch { /* best effort */ }
}

// --- SSE Event Stream ---

async function listenForEvents() {
  const streamUrl = `${API_URL}/a2a/stream/${agentId}`;
  console.log(`[AGENT] Opening SSE: ${streamUrl}`);

  const res = await fetch(streamUrl, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  });

  if (!res.ok) throw new Error(`SSE stream failed: ${res.status}`);
  writeStatus({ sse: 'open' });

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

async function handleEvent(eventType, data) {
  writeStatus({ last_event: new Date().toISOString(), last_event_type: eventType });
  const actionableEvents = ['task_available', 'task_assigned', 'approval_needed', 'review_needed', 'rework_needed'];

  if (eventType === 'revoked') {
    writeStatus({ connected: false, sse: 'revoked' });
    console.log('[AGENT] Device key REVOKED by user. Shutting down gracefully.');
    try {
      execFileSync('tmux', ['send-keys', '-t', SESSION, 'Escape'], { timeout: 3000 });
    } catch { /* best effort */ }
    setTimeout(() => {
      try {
        execFileSync('tmux', ['send-keys', '-t', SESSION, '/exit', 'Enter'], { timeout: 3000 });
      } catch { /* best effort */ }
      setTimeout(() => process.exit(0), 2000);
    }, 1000);
    return;
  } else if (actionableEvents.includes(eventType)) {
    console.log(`[AGENT] ${eventType}: ${data.task_slug || ''}`);
    // Brain read: enrich task with brain context before delivering
    const brainContext = await queryBrainViaA2A(
      `Recent decisions, procedures, and context for task: ${data.task_slug || ''} ${data.title || ''}`
    );
    const instruction = buildInstruction(eventType, data);
    const enriched = brainContext
      ? `${instruction}\n\n[BRAIN CONTEXT]\n${brainContext}`
      : instruction;
    await deliverToTmux(enriched);
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
  const context = data.dna?.description?.substring(0, 150) || title;

  // Pure-text task instruction. No URLs, no curl, no localhost.
  // - To deliver results: a2a-deliver.cjs (the script handles the URL configuration)
  // - To contribute to brain: just complete the task; the body will prompt for learnings
  return `[TASK] ${slug} — ${title}\nRole: ${ROLE} | Next status: ${nextStatus}\n${instruction}\nContext: ${context}\n\nWhen done, deliver via: node ${DELIVER_SCRIPT} --slug ${slug} --transition ${nextStatus} --role ${ROLE}`;
}

async function deliverToTmux(message) {
  try {
    // Bracketed paste via NAMED tmux buffer to avoid cross-body race condition.
    //
    // Required flags:
    //   -b <name> : use a named buffer per body (avoids global buffer race)
    //   -p        : enable bracketed paste mode (Claude treats as paste, not typed)
    //   -r        : do not replace LF with separator (preserve newlines)
    //   -d        : delete the named buffer after pasting (cleanup)
    //
    // CRITICAL: paste-buffer is asynchronous. The data streams through tmux to the
    // terminal over time. If Enter is sent immediately after, it arrives BEFORE the
    // paste content finishes streaming, and Claude submits empty input.
    // Wait for the paste to complete before sending Enter.
    const bufferName = `xpo-${ROLE}`;
    const tmpFile = `/tmp/xpo-deliver-${ROLE}.txt`;
    writeFileSync(tmpFile, message);
    execFileSync('tmux', ['load-buffer', '-b', bufferName, tmpFile], { timeout: 5000 });
    execFileSync('tmux', ['paste-buffer', '-b', bufferName, '-p', '-r', '-d', '-t', SESSION], { timeout: 5000 });
    // Poll the pane for the LAST chars of the message — guarantees paste fully streamed.
    // First-chars detection gives false positive while paste is still in progress.
    const lastChars = message.replace(/\s+/g, ' ').slice(-20).trim();
    let polled = 0;
    const maxPolls = 50;  // 50 * 200ms = 10s max
    while (polled < maxPolls) {
      await new Promise(r => setTimeout(r, 200));
      polled++;
      try {
        const capture = execFileSync('tmux', ['capture-pane', '-t', SESSION, '-p', '-S', '-40'], { stdio: 'pipe' }).toString();
        const normalized = capture.replace(/\s+/g, ' ');
        if (normalized.includes(lastChars)) break;
      } catch { /* keep polling */ }
    }
    // Extra settling time so Claude finishes rendering before Enter
    await new Promise(r => setTimeout(r, 500));
    execFileSync('tmux', ['send-keys', '-t', SESSION, 'Enter'], { timeout: 5000 });
    console.log(`[AGENT] Delivered to ${SESSION} (paste ${message.length}b, settled after ${polled * 200}ms)`);
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

  // Step 1: Connect to A2A immediately (don't wait for LLM)
  await connectToA2A();

  // Step 2: In parallel — poll for LLM + start SSE
  // LLM polling + prompt delivery runs independently of the event stream
  (async () => {
    await waitForLlmReady();
    console.log('[AGENT] LLM detected — delivering startup prompts');
    await sendStartupPrompts();
    console.log('[AGENT] Handshake complete');
  })().catch(err => console.error(`[AGENT] Prompt delivery failed: ${err.message}`));

  // Step 3: SSE event loop — starts immediately, doesn't wait for LLM
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
