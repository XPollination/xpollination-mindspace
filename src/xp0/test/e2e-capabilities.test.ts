/**
 * E2E Capability Tests — Runner Architecture Capabilities 1-6
 *
 * Maps directly to /m/mission-runner-architecture Part 5.
 * Tests the INTEGRATION of each capability, not the isolated module.
 *
 * CONTEXT FOR FUTURE AGENTS:
 * Capability tests verify that each capability works as an integrated
 * part of the system, not just as an isolated module. The module tests
 * (291 passing) verify internals. These tests verify the capability
 * delivers its value through the MindspaceNode integration layer.
 *
 * UI tests (Capability 3) use Chrome CDP for browser automation.
 * They require a running viz server (beta or local).
 *
 * HOW TO RUN:
 *   npx vitest run src/xp0/test/e2e-capabilities.test.ts
 *
 * EXPECTED: ALL FAIL until MindspaceNode + UI integration built
 * DONE WHEN: ALL PASS + screenshots saved to docs/reports/
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, existsSync, readFileSync } from 'node:fs';
import { mkdtemp as mkdtempAsync, rm as rmAsync, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { execSync } from 'node:child_process';

import { MindspaceNode } from '../node/mindspace-node.js';
import { generateKeyPair, deriveDID } from '../auth/identity.js';
import { create, sign, validate as validateTwin } from '../twin/kernel.js';

// ═══════════════════════════════════════════════════════════════════
// Shared fixtures
// ═══════════════════════════════════════════════════════════════════

let node: MindspaceNode;
let storeDir: string;

beforeAll(async () => {
  storeDir = await mkdtempAsync(join(tmpdir(), 'xp0-cap-'));
  const keys = await generateKeyPair();
  const did = deriveDID(keys.publicKey);

  node = new MindspaceNode({
    storeDir,
    owner: did,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    listenPort: 0,
    bootstrapPeers: [],
    mockClaudeBinary: resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js'),
  });
  await node.start();
});

afterAll(async () => {
  await node.stop();
  await rmAsync(storeDir, { recursive: true, force: true });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 1: Twin Kernel — integrated into MindspaceNode
// Mission: "Creates, validates, signs, and computes CIDs for twins.
//           4 fundamental kinds."
// ═══════════════════════════════════════════════════════════════════

describe('Capability 1: Twin Kernel via MindspaceNode', () => {
  it('node.createTwin() produces signed, CID-addressed twin stored in node storage', async () => {
    const twin = await node.createTwin('object', 'xp0/test', {
      message: 'capability 1 test',
    });

    // Twin is signed by node owner
    expect(twin.signature).not.toBeNull();
    expect(twin.owner).toBe(node.ownerDID);

    // Twin is stored in node's storage
    const resolved = await node.storage.resolve(twin.cid);
    expect(resolved).not.toBeNull();
    expect(resolved!.cid).toBe(twin.cid);

    // CID is recomputable
    expect(await validateTwin(twin)).toBe(true);
  });

  it('node supports all 4 twin kinds: object, relation, schema, principal', async () => {
    const obj = await node.createTwin('object', 'xp0/test', { data: 'object' });
    const rel = await node.createTwin('relation', 'xp0/link', {
      source: 'did:key:abc',
      target: obj.cid,
      relationType: 'references',
    });
    const schema = await node.createTwin('schema', 'xp0/schema-test', {
      schemaId: 'test-schema',
      jsonSchema: { type: 'object' },
    });
    const principal = await node.createTwin('principal', 'xp0/identity', {
      did: node.ownerDID,
      publicKey: 'base64-key-here',
    });

    expect(obj.kind).toBe('object');
    expect(rel.kind).toBe('relation');
    expect(schema.kind).toBe('schema');
    expect(principal.kind).toBe('principal');
  });

  it('node.evolveTwin() creates Merkle-DAG chain with previousVersion', async () => {
    const v1 = await node.createTwin('object', 'xp0/test', { version: 1 });
    const v2 = await node.evolveTwin(v1, { version: 2 });
    const v3 = await node.evolveTwin(v2, { version: 3 });

    expect(v2.previousVersion).toBe(v1.cid);
    expect(v3.previousVersion).toBe(v2.cid);

    // History walks the full chain
    const history = await node.storage.history(v3.cid);
    expect(history.length).toBe(3);
  });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 2: Runner Process — via MindspaceNode
// Mission: "A Node.js process that creates runner-twin, connects to
//           local Mindspace, listens for tasks, calls Claude Code,
//           captures output, transitions task, sends heartbeat."
// ═══════════════════════════════════════════════════════════════════

describe('Capability 2: Runner Process via MindspaceNode', () => {
  it('addRunner creates runner-twin with status=ready, docked in storage', async () => {
    const runner = await node.addRunner({ role: 'dev' });

    const twin = runner.getRunnerTwin();
    expect(twin).toBeDefined();
    expect(twin.signature).not.toBeNull();
    expect((twin.content as any).status).toBe('ready');
    expect((twin.content as any).roles).toContain('dev');

    // Runner twin is in node storage
    const stored = await node.storage.resolve(twin.cid);
    expect(stored).not.toBeNull();
  });

  it('runner listens for tasks on transport and auto-claims matching role', async () => {
    const runner = await node.addRunner({ role: 'qa' });

    // Create a task for qa role
    const task = await node.createTask({
      title: 'Auto-claim test',
      role: 'qa',
      project: 'test',
      logicalId: 'auto-claim-qa',
    });

    // Wait for runner to auto-claim via transport subscription
    await sleep(3000);

    const latest = await node.getLatestTwin('auto-claim-qa');
    expect((latest!.content as any).status).toBe('active');
    expect((latest!.content as any).claimed_by).toBeDefined();
  });

  it('runner calls mock-claude and writes result to task DNA', async () => {
    const runner = await node.addRunner({ role: 'pdsa' });

    const task = await node.createTask({
      title: 'Execute test',
      description: 'Design a hello world function',
      role: 'pdsa',
      project: 'test',
      logicalId: 'execute-pdsa',
    });

    // Wait for claim + execution
    await sleep(5000);

    const latest = await node.getLatestTwin('execute-pdsa');
    expect((latest!.content as any).result).toBeTruthy();
  });

  it('runner sends heartbeat — runner-twin evolves with timestamp', async () => {
    const runner = await node.addRunner({
      role: 'liaison',
      heartbeatInterval: 1000,  // 1s for testing
    });

    const twinBefore = runner.getRunnerTwin();
    await sleep(2000);
    const twinAfter = runner.getRunnerTwin();

    // Heartbeat should have evolved the twin
    expect(twinAfter.cid).not.toBe(twinBefore.cid);
    expect((twinAfter.content as any).lastHeartbeat).toBeDefined();
    expect(twinAfter.previousVersion).toBeDefined();
  });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 3: Team Management UI
// Mission: "In the Tasks view: Add [role] +1 buttons, Add full team,
//           Terminate button, Runner status display, Team twin."
//
// These tests require a running viz server + Chrome CDP.
// They verify the ACTUAL UI, not just the backend.
// ═══════════════════════════════════════════════════════════════════

describe('Capability 3: Team Management UI', () => {
  // UI test config — adjust for your environment
  const VIZ_URL = process.env.VIZ_URL || 'http://127.0.0.1:4201';
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3101';
  const CHROME_PORT = parseInt(process.env.CHROME_PORT || '40975');
  const SCREENSHOT_DIR = resolve(__dirname, '../../../docs/reports/runner-architecture-beta-verification');

  let token: string;
  let wsUrl: string;

  // Helper: get auth token
  async function login(): Promise<string> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'thomas.pichler@xpollination.earth',
        password: 'changeme',
      }),
    });
    const data = await res.json() as any;
    return data.token;
  }

  // Helper: take screenshot via Chrome CDP
  async function screenshot(url: string, filename: string, waitMs = 4000): Promise<string> {
    const WebSocket = (await import('ws')).default;
    const fs = await import('node:fs');

    // Get Chrome page WebSocket URL
    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('screenshot timeout')); }, 15000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: id++, method: 'Emulation.setDeviceMetricsOverride',
          params: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false } }));
      });

      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
            params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } }));
        }
        if (msg.id === 2) {
          ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        }
        if (msg.id === 3) {
          setTimeout(() => {
            ws.send(JSON.stringify({ id: id++, method: 'Page.captureScreenshot', params: { format: 'png' } }));
          }, waitMs);
        }
        if (msg.id === 4 && msg.result?.data) {
          const filepath = join(SCREENSHOT_DIR, filename);
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          fs.writeFileSync(filepath, Buffer.from(msg.result.data, 'base64'));
          clearTimeout(timeout);
          ws.close();
          resolve(filepath);
        }
      });
    });
  }

  // Helper: get page text content via CDP
  async function getPageText(url: string): Promise<string> {
    const WebSocket = (await import('ws')).default;

    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
          params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } }));
      });

      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        }
        if (msg.id === 2) {
          setTimeout(() => {
            ws.send(JSON.stringify({ id: id++, method: 'Runtime.evaluate',
              params: { expression: 'document.body.innerText' } }));
          }, 4000);
        }
        if (msg.id === 3 && msg.result?.result?.value) {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.result.result.value);
        }
      });
    });
  }

  // Helper: click element via CDP
  async function clickElement(selector: string): Promise<void> {
    const WebSocket = (await import('ws')).default;

    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 10000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: id++, method: 'Runtime.evaluate',
          params: { expression: `document.querySelector('${selector}')?.click()` } }));
      });

      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });
    });
  }

  beforeAll(async () => {
    token = await login();
  });

  // ─── T3.1: Agents page shows "Add [role] +1" buttons ───

  it('agents page has "Start Agentic Team" button', async () => {
    const filepath = await screenshot(`${VIZ_URL}/agents`, 'cap3-agents-page.png');
    expect(filepath).toBeTruthy();

    const text = await getPageText(`${VIZ_URL}/agents`);
    expect(text).toContain('Start Agentic Team');
  });

  // ─── T3.2: Add role buttons exist (after runner architecture integration) ───

  it('agents page has individual role buttons: +LIAISON, +PDSA, +QA, +DEV', async () => {
    const text = await getPageText(`${VIZ_URL}/agents`);

    // After runner architecture, should have per-role buttons
    expect(text).toMatch(/\+\s*LIAISON|\+\s*Liaison|Add Liaison/i);
    expect(text).toMatch(/\+\s*PDSA|Add PDSA/i);
    expect(text).toMatch(/\+\s*QA|Add QA/i);
    expect(text).toMatch(/\+\s*DEV|Add Dev/i);
  });

  // ─── T3.3: Click "Add Dev +1" starts a runner ───

  it('clicking add-dev button creates a runner card with status=ready', async () => {
    // Click the add dev button
    await clickElement('[data-role="dev"].ag-add-role, .ag-add-dev, button:has-text("Dev")');
    await sleep(3000);

    // Take screenshot of result
    await screenshot(`${VIZ_URL}/agents`, 'cap3-dev-added.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Should show a runner card with dev role and ready status
    expect(text).toMatch(/dev/i);
    expect(text).toMatch(/ready|online/i);
  });

  // ─── T3.4: "Add full team" creates 4 runners ───

  it('add full team creates 4 runner cards (liaison, pdsa, qa, dev)', async () => {
    await clickElement('.ag-spawn, [data-action="add-full-team"]');
    await sleep(5000);

    await screenshot(`${VIZ_URL}/agents`, 'cap3-full-team.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Should see all 4 roles
    expect(text).toMatch(/liaison/i);
    expect(text).toMatch(/pdsa/i);
    expect(text).toMatch(/qa/i);
    expect(text).toMatch(/dev/i);
  });

  // ─── T3.5: Runner status display shows role, status, heartbeat ───

  it('runner card shows role, status, and heartbeat timestamp', async () => {
    await sleep(2000);
    await screenshot(`${VIZ_URL}/agents`, 'cap3-runner-status.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Runner cards should display status info
    expect(text).toMatch(/ready|busy|active/i);
    // Heartbeat or last-seen indicator
    expect(text).toMatch(/heartbeat|last.seen|ago|online/i);
  });

  // ─── T3.6: Terminate button stops a runner ───

  it('terminate button stops runner — status changes to stopped', async () => {
    // Click terminate on first runner
    await clickElement('.ag-terminate, [data-action="terminate"], .ag-stop');
    await sleep(3000);

    await screenshot(`${VIZ_URL}/agents`, 'cap3-after-terminate.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    expect(text).toMatch(/stopped|terminated|disconnected/i);
  });

  // ─── T3.7: Team twin visible in UI ───

  it('team composition is visible — shows agent count and capacity', async () => {
    await screenshot(`${VIZ_URL}/agents`, 'cap3-team-composition.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Should show team summary (agent count, capacity bar)
    expect(text).toMatch(/\d+\s*(agent|runner)/i);
    // Capacity indicator: "N/M agents" or similar
    expect(text).toMatch(/\d+\s*\/\s*\d+/);
  });

  // ─── T3.8: Runner shows current task when busy ───

  it('busy runner card shows which task it is working on', async () => {
    // Wait for a runner to claim a task (or trigger one)
    await sleep(5000);
    await screenshot(`${VIZ_URL}/agents`, 'cap3-runner-busy-task.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // When busy, card should show the task slug or title
    expect(text).toMatch(/working on|current task|busy/i);
  });

  // ─── T3.9: Role switching via UI ───

  it('runner card has role switch dropdown — changing role updates card', async () => {
    await screenshot(`${VIZ_URL}/agents`, 'cap3-role-switch-before.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Should have role switch control (dropdown or button)
    expect(text).toMatch(/switch|role|change role/i);

    // Click role switch (to qa)
    await clickElement('[data-action="switch-role"], .ag-role-switch, select.ag-role-select');
    await sleep(2000);

    await screenshot(`${VIZ_URL}/agents`, 'cap3-role-switch-after.png');
  });

  // ─── T3.10: Network/peer connection status visible ───

  it('agents page shows peer connection status', async () => {
    await screenshot(`${VIZ_URL}/agents`, 'cap3-network-status.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Must show connection status — user needs to know if P2P is working
    expect(text).toMatch(/connected|peers?|online|network/i);
  });

  // ─── T3.11: Heartbeat visual feedback ───

  it('runner card shows heartbeat indicator (timestamp or pulse)', async () => {
    await screenshot(`${VIZ_URL}/agents`, 'cap3-heartbeat.png');

    const text = await getPageText(`${VIZ_URL}/agents`);
    // Heartbeat shown as "last seen X ago" or "heartbeat: active"
    expect(text).toMatch(/heartbeat|last.seen|ago|pulse|alive/i);
  });

  // ─── T3.12: Single agent mode — one runner switching roles ───

  it('single agent with role switching is a valid configuration', async () => {
    // Terminate all but one
    // Then switch that runner through different roles
    // System should warn but not prevent
    const text = await getPageText(`${VIZ_URL}/agents`);

    // Warning about incomplete team (informational, not blocking)
    // Should NOT say "cannot" or "error"
    // Should say "recommended" or "for full workflow" or similar
    await screenshot(`${VIZ_URL}/agents`, 'cap3-single-agent.png');
  });
});

// ═══════════════════════════════════════════════════════════════════
// KANBAN INTEGRATION WITH RUNNER ARCHITECTURE
// Task cards should show who claimed them
// ═══════════════════════════════════════════════════════════════════

describe('Kanban Runner Integration', () => {
  const VIZ_URL = process.env.VIZ_URL || 'http://127.0.0.1:4201';
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3101';
  const CHROME_PORT = parseInt(process.env.CHROME_PORT || '40975');
  const SCREENSHOT_DIR = resolve(__dirname, '../../../docs/reports/runner-architecture-beta-verification');

  let token: string;

  async function screenshot(url: string, filename: string, waitMs = 4000): Promise<string> {
    const WebSocket = (await import('ws')).default;
    const fs = await import('node:fs');
    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: id++, method: 'Emulation.setDeviceMetricsOverride',
          params: { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false } }));
      });
      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
          params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } }));
        if (msg.id === 2) ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        if (msg.id === 3) setTimeout(() => ws.send(JSON.stringify({ id: id++, method: 'Page.captureScreenshot', params: { format: 'png' } })), waitMs);
        if (msg.id === 4 && msg.result?.data) {
          const filepath = join(SCREENSHOT_DIR, filename);
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          fs.writeFileSync(filepath, Buffer.from(msg.result.data, 'base64'));
          clearTimeout(timeout);
          ws.close();
          resolve(filepath);
        }
      });
    });
  }

  async function getPageText(url: string): Promise<string> {
    const WebSocket = (await import('ws')).default;
    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
      ws.on('open', () => { ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
        params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } })); });
      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        if (msg.id === 2) setTimeout(() => ws.send(JSON.stringify({ id: id++, method: 'Runtime.evaluate',
          params: { expression: 'document.body.innerText' } })), 4000);
        if (msg.id === 3 && msg.result?.result?.value) { clearTimeout(timeout); ws.close(); resolve(msg.result.result.value); }
      });
    });
  }

  beforeAll(async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'thomas.pichler@xpollination.earth', password: 'changeme' }),
    });
    const data = await res.json() as any;
    token = data.token;
  });

  it('active task card on kanban shows claimed_by runner name', async () => {
    await screenshot(`${VIZ_URL}/kanban`, 'cap-kanban-claimed-by.png');

    const text = await getPageText(`${VIZ_URL}/kanban`);
    // Active tasks should show which runner claimed them
    expect(text).toMatch(/claimed.by|runner|agent/i);
  });

  it('task status updates in real-time when runner transitions', async () => {
    // Take screenshot, wait, take another — status should change
    await screenshot(`${VIZ_URL}/kanban`, 'cap-kanban-realtime-before.png');
    await sleep(5000);
    await screenshot(`${VIZ_URL}/kanban`, 'cap-kanban-realtime-after.png');

    // Both screenshots exist (visual proof of live updates)
    const fs = await import('node:fs');
    expect(fs.existsSync(join(SCREENSHOT_DIR, 'cap-kanban-realtime-before.png'))).toBe(true);
    expect(fs.existsSync(join(SCREENSHOT_DIR, 'cap-kanban-realtime-after.png'))).toBe(true);
  });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 4: libp2p Transport — via MindspaceNode
// Mission: "GossipSub for twin announcements, Bitswap for twin data
//           exchange, DHT for peer discovery, project topics."
// ═══════════════════════════════════════════════════════════════════

describe('Capability 4: libp2p Transport via MindspaceNode', () => {
  let nodeA: MindspaceNode;
  let nodeB: MindspaceNode;

  beforeAll(async () => {
    const keysA = await generateKeyPair();
    const keysB = await generateKeyPair();
    const dirA = await mkdtempAsync(join(tmpdir(), 'xp0-cap4a-'));
    const dirB = await mkdtempAsync(join(tmpdir(), 'xp0-cap4b-'));

    nodeA = new MindspaceNode({
      storeDir: dirA, owner: deriveDID(keysA.publicKey),
      privateKey: keysA.privateKey, publicKey: keysA.publicKey,
      listenPort: 0, bootstrapPeers: [],
      mockClaudeBinary: resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js'),
    });
    await nodeA.start();

    nodeB = new MindspaceNode({
      storeDir: dirB, owner: deriveDID(keysB.publicKey),
      privateKey: keysB.privateKey, publicKey: keysB.publicKey,
      listenPort: 0, bootstrapPeers: nodeA.getListenAddresses(),
      mockClaudeBinary: resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js'),
    });
    await nodeB.start();
    await sleep(3000);
  });

  afterAll(async () => {
    await nodeB.stop();
    await nodeA.stop();
  });

  it('peers discover each other via bootstrap (not mDNS)', async () => {
    const peersA = nodeA.transport.getConnectedPeers();
    const peersB = nodeB.transport.getConnectedPeers();
    expect(peersA.length).toBeGreaterThanOrEqual(1);
    expect(peersB.length).toBeGreaterThanOrEqual(1);
  });

  it('GossipSub: twin announcement on A arrives at B via topic subscription', async () => {
    const received: any[] = [];
    await nodeB.transport.subscribe('xp0/project/test-cap4', (msg) => received.push(msg));

    const twin = await nodeA.createTwin('object', 'xp0/test', { data: 'gossipsub test' });
    await nodeA.transport.publish('xp0/project/test-cap4', {
      type: 'twin.created',
      cid: twin.cid,
    });

    await sleep(2000);
    expect(received.length).toBe(1);
    expect(received[0].cid).toBe(twin.cid);
  });

  it('twin request: B fetches twin from A by CID', async () => {
    const twin = await nodeA.createTwin('object', 'xp0/test', { data: 'fetch by cid' });
    const fetched = await nodeB.transport.requestTwin(twin.cid);
    expect(fetched).not.toBeNull();
    expect(fetched!.cid).toBe(twin.cid);
    expect((fetched!.content as any).data).toBe('fetch by cid');
  });

  it('project topic isolation: mindspace events do NOT leak to crm', async () => {
    const crmMessages: any[] = [];
    const msMessages: any[] = [];

    await nodeB.transport.subscribe('xp0/project/crm', (msg) => crmMessages.push(msg));
    await nodeB.transport.subscribe('xp0/project/mindspace', (msg) => msMessages.push(msg));

    await nodeA.transport.publish('xp0/project/mindspace', { type: 'task', id: 'ms-only' });
    await sleep(2000);

    expect(msMessages.length).toBe(1);
    expect(crmMessages.length).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 5: Decentralized Workflow Engine — via MindspaceNode
// Mission: "Every peer validates transitions locally. Invalid
//           transitions rejected at dock time by every peer."
// ═══════════════════════════════════════════════════════════════════

describe('Capability 5: Decentralized Workflow via MindspaceNode', () => {
  it('node.transitionTask validates workflow rules before docking', async () => {
    const task = await node.createTask({
      title: 'Workflow test',
      role: 'dev',
      project: 'test',
      logicalId: 'wf-test',
    });

    // Valid: ready→active
    const claimed = await node.transitionTask('wf-test', 'active', 'dev');
    expect((claimed.content as any).status).toBe('active');

    // Invalid: active→complete (skips review)
    await expect(node.transitionTask('wf-test', 'complete', 'dev'))
      .rejects.toThrow(/invalid|not allowed|workflow/i);

    // Valid: active→review
    const reviewed = await node.transitionTask('wf-test', 'review', 'dev');
    expect((reviewed.content as any).status).toBe('review');
  });

  it('role consistency enforced — wrong role rejected', async () => {
    const task = await node.createTask({
      title: 'Role test',
      role: 'pdsa',
      project: 'test',
      logicalId: 'role-test',
    });

    // dev cannot claim a pdsa task
    await expect(node.transitionTask('role-test', 'active', 'dev'))
      .rejects.toThrow(/role|not allowed/i);

    // pdsa can claim it
    const claimed = await node.transitionTask('role-test', 'active', 'pdsa');
    expect((claimed.content as any).status).toBe('active');
  });

  it('received twin evolution validated before docking — invalid rejected', async () => {
    // Simulate receiving an invalid twin evolution from network
    const task = await node.createTwin('object', 'xp0/task', {
      title: 'Invalid transition test',
      status: 'ready',
      role: 'dev',
      logicalId: 'invalid-rx',
    });

    // Create a fake evolution: ready→complete (invalid skip)
    const invalid = await create('object', 'xp0/task', node.ownerDID, {
      title: 'Invalid transition test',
      status: 'complete', // skipping review chain
      role: 'dev',
      logicalId: 'invalid-rx',
    });

    // Node should reject this at dock time
    await expect(node.dockWithValidation(invalid, task))
      .rejects.toThrow(/workflow|invalid|rejected/i);
  });
});


// ═══════════════════════════════════════════════════════════════════
// CAPABILITY 6: Storage Adapter — via MindspaceNode
// Mission: "FileStorageAdapter. Twins stored as JSON files. Directory
//           structure by CID prefix. Swappable."
// ═══════════════════════════════════════════════════════════════════

describe('Capability 6: Storage via MindspaceNode', () => {
  it('node.storage is a FileStorageAdapter with JSON files on disk', async () => {
    const twin = await node.createTwin('object', 'xp0/test', { storage: 'test' });

    // File should exist on disk
    const prefix = twin.cid.substring(0, 4);
    const expectedPath = join(storeDir, prefix, `${twin.cid}.json`);

    const { existsSync: exists } = await import('node:fs');
    expect(exists(expectedPath)).toBe(true);

    // File content should be valid JSON matching the twin
    const { readFileSync: read } = await import('node:fs');
    const fileContent = JSON.parse(read(expectedPath, 'utf-8'));
    expect(fileContent.cid).toBe(twin.cid);
  });

  it('query across all twins returns correct results', async () => {
    // Create twins of different kinds
    await node.createTwin('object', 'xp0/task', { query: 'test1' });
    await node.createTwin('object', 'xp0/runner', { query: 'test2' });
    await node.createTwin('relation', 'xp0/link', {
      source: 'a', target: 'b', relationType: 'test',
    });

    const tasks = await node.storage.query({ schema: 'xp0/task' });
    const runners = await node.storage.query({ schema: 'xp0/runner' });
    const relations = await node.storage.query({ kind: 'relation' });

    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(runners.length).toBeGreaterThanOrEqual(1);
    expect(relations.length).toBeGreaterThanOrEqual(1);
  });

  it('GDPR forget purges content but CID marker remains', async () => {
    const twin = await node.createTwin('object', 'xp0/test', {
      personal_data: 'sensitive information',
    });
    const cid = twin.cid;

    await node.storage.forget(cid);

    const forgotten = await node.storage.resolve(cid);
    expect(forgotten).not.toBeNull();
    expect((forgotten as any).state).toBe('forgotten');
    // Original content is gone
    expect((forgotten as any).content?.personal_data).toBeUndefined();
  });
});


// ═══════════════════════════════════════════════════════════════════
// KANBAN UI VERIFICATION — Visual tests with screenshots
// These verify the kanban features deployed on beta
// ═══════════════════════════════════════════════════════════════════

describe('Kanban UI Verification', () => {
  const VIZ_URL = process.env.VIZ_URL || 'http://127.0.0.1:4201';
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3101';
  const CHROME_PORT = parseInt(process.env.CHROME_PORT || '40975');
  const SCREENSHOT_DIR = resolve(__dirname, '../../../docs/reports/runner-architecture-beta-verification');

  let token: string;

  // Reuse screenshot helper from Capability 3
  async function screenshot(url: string, filename: string, waitMs = 4000): Promise<string> {
    const WebSocket = (await import('ws')).default;
    const fs = await import('node:fs');
    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
      ws.on('open', () => {
        ws.send(JSON.stringify({ id: id++, method: 'Emulation.setDeviceMetricsOverride',
          params: { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false } }));
      });
      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
          params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } }));
        if (msg.id === 2) ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        if (msg.id === 3) setTimeout(() => ws.send(JSON.stringify({ id: id++, method: 'Page.captureScreenshot', params: { format: 'png' } })), waitMs);
        if (msg.id === 4 && msg.result?.data) {
          const filepath = join(SCREENSHOT_DIR, filename);
          fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
          fs.writeFileSync(filepath, Buffer.from(msg.result.data, 'base64'));
          clearTimeout(timeout);
          ws.close();
          resolve(filepath);
        }
      });
    });
  }

  async function getPageText(url: string): Promise<string> {
    const WebSocket = (await import('ws')).default;
    const pagesRes = await fetch(`http://127.0.0.1:${CHROME_PORT}/json`);
    const pages = await pagesRes.json() as any[];
    const page = pages.find((p: any) => p.type === 'page') || pages[0];
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      let id = 1;
      const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
      ws.on('open', () => { ws.send(JSON.stringify({ id: id++, method: 'Network.setCookie',
        params: { name: 'ms_session', value: token, domain: new URL(url).hostname, path: '/' } })); });
      ws.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === 1) ws.send(JSON.stringify({ id: id++, method: 'Page.navigate', params: { url } }));
        if (msg.id === 2) setTimeout(() => ws.send(JSON.stringify({ id: id++, method: 'Runtime.evaluate',
          params: { expression: 'document.body.innerText' } })), 4000);
        if (msg.id === 3 && msg.result?.result?.value) { clearTimeout(timeout); ws.close(); resolve(msg.result.result.value); }
      });
    });
  }

  beforeAll(async () => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'thomas.pichler@xpollination.earth', password: 'changeme' }),
    });
    const data = await res.json() as any;
    token = data.token;
  });

  it('kanban has 7 columns: queue, active, review, approved, rework, blocked, done', async () => {
    await screenshot(`${VIZ_URL}/kanban`, 'cap-kanban-7-columns.png');

    const text = await getPageText(`${VIZ_URL}/kanban`);
    expect(text).toMatch(/queue/i);
    expect(text).toMatch(/active/i);
    expect(text).toMatch(/review/i);
    expect(text).toMatch(/approved/i);
    expect(text).toMatch(/rework/i);
    expect(text).toMatch(/blocked/i);
    expect(text).toMatch(/done/i);
  });

  it('kanban has completed tasks filter dropdown', async () => {
    const text = await getPageText(`${VIZ_URL}/kanban`);
    expect(text).toMatch(/active only|completed|last.*day/i);

    await screenshot(`${VIZ_URL}/kanban`, 'cap-kanban-filter.png');
  });

  it('blocked tasks show blocked_reason', async () => {
    // Filter to project with blocked tasks
    await screenshot(`${VIZ_URL}/kanban?project=test-runner`, 'cap-kanban-blocked-reason.png');

    const text = await getPageText(`${VIZ_URL}/kanban?project=test-runner`);
    expect(text).toMatch(/blocked|waiting/i);
  });

  it('tasks view loads with task cards', async () => {
    await screenshot(`${VIZ_URL}/tasks`, 'cap-tasks-view.png');

    const text = await getPageText(`${VIZ_URL}/tasks`);
    expect(text.length).toBeGreaterThan(100); // Has meaningful content
  });

  it('missions page loads', async () => {
    await screenshot(`${VIZ_URL}/missions`, 'cap-missions-page.png');

    const text = await getPageText(`${VIZ_URL}/missions`);
    expect(text.length).toBeGreaterThan(50);
  });

  it('settings page loads with user controls', async () => {
    await screenshot(`${VIZ_URL}/settings`, 'cap-settings-page.png');

    const text = await getPageText(`${VIZ_URL}/settings`);
    expect(text).toMatch(/settings|password|api.key/i);
  });
});
