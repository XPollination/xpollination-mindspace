#!/usr/bin/env node
// SDK Agent Runner — sidecar alternative to xpo-agent.js + Claude CLI
//
// Connects to A2A Hive (Ed25519 device key), opens SSE stream, logs events.
// Stage 1: auth + connect + event log only. SDK streaming push added in Stage 2.
//
// Usage:
//   node runner.mjs --role liaison-sdk --key ~/.xp0/keys/prod.json

import { parseArgs } from 'node:util';
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
          // Stage 2 TODO: push into SDK streaming input
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
      await Promise.race([listenSSE(), heartbeatLoop()]);
    } catch (err) {
      log(`ERROR: ${err.message} — reconnecting in ${reconnectDelay}ms`);
      await new Promise(r => setTimeout(r, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }
  }
}

main().catch(err => {
  log(`FATAL: ${err.stack || err.message}`);
  process.exit(1);
});
