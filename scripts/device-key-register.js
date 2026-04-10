#!/usr/bin/env node
/**
 * device-key-register.js — Generate Ed25519 keypair and register with Mindspace.
 *
 * Called by claude-session.sh after device flow approval.
 * Generates keypair locally, sends public key to server, stores private key at ~/.xp0/keys/<server>.json.
 *
 * Usage: node device-key-register.js --api <url> --token <jwt>
 */

import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { hostname } from 'node:os';
import { join } from 'node:path';

const { values: args } = parseArgs({
  options: {
    api:   { type: 'string' },
    token: { type: 'string' },
    name:  { type: 'string', default: hostname() },
  },
  strict: false,
});

if (!args.api || !args.token) {
  console.error('Usage: node device-key-register.js --api <url> --token <jwt>');
  process.exit(1);
}

async function main() {
  const apiBase = args.api;
  const jwt = args.token;
  const deviceName = args.name;

  // 1. Generate Ed25519 keypair
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });

  // 2. Register public key with server
  const res = await fetch(`${apiBase}/api/auth/device-keys/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({ public_key: publicKeyPem, name: deviceName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Registration failed (${res.status}):`, err.error || 'unknown');
    process.exit(1);
  }

  const data = await res.json();

  // 3. Determine server host for filename (just hostname, not full URL)
  const serverHost = apiBase
    .replace(/^https?:\/\//, '')
    .replace(/:\d+.*$/, '')
    .replace(/\/.*$/, '');

  // 4. Write key file
  // server field stores the FULL API URL (single source of truth) — body uses this directly
  const keysDir = join(process.env.HOME || '/tmp', '.xp0', 'keys');
  mkdirSync(keysDir, { recursive: true });

  const keyFile = join(keysDir, `${serverHost}.json`);
  const keyData = {
    server: apiBase,  // FULL URL — body uses this as API_URL with no further processing
    server_host: serverHost,  // hostname only, for reference
    key_id: data.key_id,
    user: data.user || '',
    registered: data.registered || new Date().toISOString(),
    algorithm: 'ed25519',
    private_key: privateKeyPem.toString(),
  };

  writeFileSync(keyFile, JSON.stringify(keyData, null, 2));
  try { chmodSync(keyFile, 0o600); } catch { /* best effort */ }

  console.log(`Device key registered: ${data.key_id}`);
  console.log(`Key file: ${keyFile}`);
}

main().catch(err => {
  console.error('Registration error:', err.message);
  process.exit(1);
});
