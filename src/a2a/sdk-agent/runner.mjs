#!/usr/bin/env node
// SDK Agent Runner — sidecar alternative to xpo-agent.js + Claude CLI
//
// Connects to A2A Hive (Ed25519 device key), opens SSE stream, pushes each
// event into a Claude Agent SDK streaming-input query. Assistant output is
// logged; A2A deliver-back is Stage 3.
//
// Usage:
//   node runner.mjs --role liaison-sdk --key ~/.xp0/keys/prod.json

import { parseArgs } from 'node:util';
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';

const { values: args } = parseArgs({
  options: {
    role:    { type: 'string', default: 'liaison-sdk' },
    project: { type: 'string', default: 'xpollination-mindspace' },
    key:     { type: 'string' },
    logfile: { type: 'string' },
  },
});

const ROLE = args.role;
const PROJECT = args.project;
const LOGFILE = args.logfile || `/tmp/xpo-agent-${ROLE}.log`;

mkdirSync(dirname(LOGFILE), { recursive: true });

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.join(' ')}`;
  try { appendFileSync(LOGFILE, line + '\n'); } catch (err) { process.stderr.write(`log write failed: ${err.message}\n`); }
}

if (!args.key || !existsSync(args.key)) {
  log(`FATAL: --key required, ${args.key} does not exist`);
  process.exit(1);
}

const deviceKey = JSON.parse(readFileSync(args.key, 'utf-8'));
log(`Device key loaded: ${deviceKey.key_id} (${deviceKey.algorithm}, server=${deviceKey.server})`);

let API_URL = deviceKey.server;
let agentId = null;
let sessionToken = null;

// Push-based async queue of SDKUserMessage, consumed by sdkQuery().
// Each SSE event translates to one message.
function createUserMessageQueue() {
  const waiters = [];
  const buffer = [];
  let closed = false;
  return {
    push(msg) {
      if (closed) return;
      if (waiters.length > 0) waiters.shift().resolve({ value: msg, done: false });
      else buffer.push(msg);
    },
    close() {
      closed = true;
      while (waiters.length > 0) waiters.shift().resolve({ value: undefined, done: true });
    },
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (buffer.length > 0) return Promise.resolve({ value: buffer.shift(), done: false });
          if (closed) return Promise.resolve({ value: undefined, done: true });
          return new Promise(resolve => waiters.push({ resolve }));
        },
        return: () => { closed = true; return Promise.resolve({ value: undefined, done: true }); },
      };
    },
  };
}

function eventToUserMessage(eventType, data) {
  const text = `[A2A EVENT ${eventType}]\n${JSON.stringify(data, null, 2)}`;
  return {
    type: 'user',
    message: { role: 'user', content: text },
    parent_tool_use_id: null,
  };
}

let sdkSession = null; // { queue, query, consumer }

function startSDKSession() {
  const queue = createUserMessageQueue();
  const systemPrompt = [
    `You are an xp0 SDK-agent with role "${ROLE}".`,
    'You receive A2A events describing tasks, messages, and state changes from the Hive.',
    'For this stage: observe and narrate. Do not invoke tools; simply acknowledge each event.',
  ].join(' ');
  const q = sdkQuery({
    prompt: queue,
    options: { systemPrompt, model: 'claude-opus-4-7', permissionMode: 'default' },
  });
  const consumer = (async () => {
    try {
      for await (const msg of q) {
        log(`SDK ${msg.type}: ${JSON.stringify(msg).slice(0, 300)}`);
      }
      log('SDK query ended');
    } catch (err) {
      log(`SDK consumer error: ${err.stack || err.message}`);
    }
  })();
  sdkSession = { queue, query: q, consumer };
  log('SDK session started');
}

function stopSDKSession() {
  if (!sdkSession) return;
  try { sdkSession.queue.close(); } catch {}
  try { sdkSession.query.close(); } catch {}
  sdkSession = null;
  log('SDK session stopped');
}

async function connectA2A() {
  const identity = {
    agent_name: `sdk-agent-${ROLE}-${randomUUID().slice(0, 8)}`,
    key_id: deviceKey.key_id,
  };
  const body = {
    identity,
    role: { current: ROLE },
    project: { slug: PROJECT },
    state: { status: 'active' },
    // NOTE: client='xpo-agent' is a hive-side whitelist requirement for can_stream=1
    // (see api/routes/a2a-connect.ts:193). We are a new A2A body implementation,
    // so this is semantically accurate. runtime='sdk-agent' disambiguates the runtime.
    metadata: { client: 'xpo-agent', runtime: 'sdk-agent-v0.0.1', push_mode: 'sdk-streaming' },
  };

  let res = await fetch(`${API_URL}/a2a/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = await res.json();

  if (data.type === 'CHALLENGE') {
    // Hive responses use `challenge` field; some older versions used `nonce` — accept both.
    const challengeB64 = data.challenge ?? data.nonce;
    if (!challengeB64) throw new Error(`CHALLENGE missing both challenge and nonce fields: ${JSON.stringify(data)}`);
    const privateKey = createPrivateKey(deviceKey.private_key);
    const challengeBytes = Buffer.from(challengeB64, 'base64');
    const signature = sign(null, challengeBytes, privateKey);
    // Server expects identity.signature (NOT body.challenge_response) —
    // see api/routes/a2a-connect.ts authenticateIdentity().
    body.identity.signature = signature.toString('base64');
    res = await fetch(`${API_URL}/a2a/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  }

  if (data.type === 'ERROR') {
    throw new Error(`A2A connect error: ${data.error || JSON.stringify(data)}`);
  }

  agentId = data.agent_id;
  sessionToken = data.session_token;
  if (data.services?.hive && data.services.hive !== API_URL) {
    log(`Hive URL updated: ${API_URL} → ${data.services.hive}`);
    API_URL = data.services.hive;
  }
  log(`Connected. agent_id=${agentId} role=${ROLE}`);
}

async function listenSSE() {
  const url = `${API_URL}/a2a/stream/${agentId}`;
  log(`SSE opening: ${url}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${sessionToken}` } });
  if (!res.ok) throw new Error(`SSE failed: ${res.status}`);
  log('SSE open');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) throw new Error('SSE stream closed by server');
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent) {
        try {
          const data = JSON.parse(line.slice(6));
          log(`EVENT ${currentEvent}: ${JSON.stringify(data).slice(0, 200)}`);
          if (sdkSession) sdkSession.queue.push(eventToUserMessage(currentEvent, data));
        } catch (err) {
          log(`EVENT ${currentEvent}: parse error: ${err.message}`);
        }
        currentEvent = '';
      }
    }
  }
}

async function heartbeatLoop() {
  while (true) {
    await new Promise(r => setTimeout(r, 25000));
    try {
      await fetch(`${API_URL}/api/agents/${agentId}/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch {}
  }
}

async function main() {
  log(`Starting sdk-agent runner role=${ROLE} project=${PROJECT}`);
  let reconnectDelay = 5000;
  while (true) {
    try {
      await connectA2A();
      reconnectDelay = 5000;
      if (!sdkSession) startSDKSession();
      await Promise.race([listenSSE(), heartbeatLoop()]);
    } catch (err) {
      log(`ERROR: ${err.message} — reconnecting in ${reconnectDelay}ms`);
      stopSDKSession();
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }
  }
}

main().catch(err => {
  log(`FATAL: ${err.stack || err.message}`);
  process.exit(1);
});
