#!/usr/bin/env node
// Seed script: Mindspace Control Plane v1.0 mission + 10 capabilities
// Usage: DATABASE_PATH=./data/mindspace.db node api/db/seed-mission-capabilities.js
// Task: h1-4-seed-mission-capabilities

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || './data/mindspace.db';

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply required migrations
const migrations = ['002-missions-capabilities.sql', '003-capability-links.sql'];
for (const m of migrations) {
  const sql = readFileSync(join(__dirname, 'migrations', m), 'utf-8');
  db.exec(sql);
}

// Check if already seeded
const existing = db.prepare("SELECT id FROM missions WHERE title = 'Mindspace Control Plane v1.0'").get();
if (existing) {
  console.log('Mission already seeded. Skipping.');
  db.close();
  process.exit(0);
}

// --- Mission ---
const missionId = randomUUID();
db.prepare(
  `INSERT INTO missions (id, title, description, status) VALUES (?, ?, ?, ?)`
).run(
  missionId,
  'Mindspace Control Plane v1.0',
  'Build the complete Mindspace agent coordination platform: API, task engine, agent protocol, auth, marketplace, quality, integration, and organizational brain capabilities.',
  'active'
);
console.log(`Created mission: ${missionId}`);

// --- Capabilities ---
const caps = {};

const capData = [
  { key: 'FOUNDATION', title: 'Foundation', desc: 'Core API server, database, health endpoints, project management', sort: 0, deps: [], reqs: ['REQ-API-001'], taskGroups: ['A0'] },
  { key: 'AUTH', title: 'Authentication & Authorization', desc: 'User auth, API keys, Google OAuth, project access control', sort: 1, deps: ['FOUNDATION'], reqs: ['REQ-AUTH-001', 'REQ-AUTH-002', 'REQ-AUTH-003', 'REQ-ACCESS-001'], taskGroups: ['A1', 'A2'] },
  { key: 'TASK-ENGINE', title: 'Task Engine', desc: 'Task claiming, leases, heartbeat, dependencies, gates, transitions', sort: 2, deps: ['AUTH'], reqs: ['REQ-CLAIM-001', 'REQ-LEASE-001', 'REQ-HEARTBEAT-001', 'REQ-DEP-001', 'REQ-GATE-001'], taskGroups: ['A3', 'A5', 'A8', 'A9'] },
  { key: 'REQUIREMENTS', title: 'Requirements Engineering', desc: 'Requirement CRUD, versioning, traceability', sort: 3, deps: ['AUTH'], reqs: ['REQ-REQENG-001'], taskGroups: ['A4'] },
  { key: 'AGENT-PROTOCOL', title: 'Agent Protocol', desc: 'Agent registration, bonds, A2A communication, status sweep', sort: 4, deps: ['AUTH'], reqs: ['REQ-AGENT-001', 'REQ-AGENT-002', 'REQ-AGENT-003', 'REQ-A2A-001'], taskGroups: ['A7', 'A11'] },
  { key: 'ORG-BRAIN', title: 'Organizational Brain', desc: 'Multi-tenant brain routing, org-level knowledge management', sort: 5, deps: ['AUTH'], reqs: ['REQ-BRAIN-ORG-001'], taskGroups: ['A13'] },
  { key: 'RELEASE', title: 'Release Management', desc: 'Branch strategy, feature flags, release sealing', sort: 6, deps: ['TASK-ENGINE'], reqs: ['REQ-BRANCH-001', 'REQ-FEATURE-FLAGS-001'], taskGroups: ['A6', 'A10'] },
  { key: 'MARKETPLACE', title: 'Marketplace', desc: 'Announcements, requests, community needs', sort: 7, deps: ['TASK-ENGINE'], reqs: ['REQ-MARKET-001', 'REQ-COMMUNITY-001'], taskGroups: ['A14', 'A15'] },
  { key: 'QUALITY', title: 'Quality Assurance', desc: 'Bug reports, test infrastructure, quality gates', sort: 8, deps: ['TASK-ENGINE'], reqs: ['REQ-BUG-001'], taskGroups: ['A16'] },
  { key: 'INTEGRATION', title: 'MCP Integration', desc: 'MCP-to-Mindspace bridge tools, project status', sort: 9, deps: ['TASK-ENGINE'], reqs: ['REQ-MCP-MINDSPACE-001'], taskGroups: ['A12'] },
];

const insertCap = db.prepare(
  `INSERT INTO capabilities (id, mission_id, title, description, status, dependency_ids, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const insertReq = db.prepare(
  `INSERT INTO capability_requirements (capability_id, requirement_ref) VALUES (?, ?)`
);

const insertTask = db.prepare(
  `INSERT INTO capability_tasks (capability_id, task_slug) VALUES (?, ?)`
);

// First pass: create all capabilities
for (const cap of capData) {
  const id = randomUUID();
  caps[cap.key] = id;
  // deps will be set in second pass
  insertCap.run(id, missionId, cap.title, cap.desc, 'active', '[]', cap.sort);
  console.log(`Created capability: CAP-${cap.key} (${id})`);
}

// Second pass: set dependency_ids
const updateDeps = db.prepare(`UPDATE capabilities SET dependency_ids = ? WHERE id = ?`);
for (const cap of capData) {
  if (cap.deps.length > 0) {
    const depIds = cap.deps.map(d => caps[d]);
    updateDeps.run(JSON.stringify(depIds), caps[cap.key]);
  }
}

// Third pass: link requirements
for (const cap of capData) {
  for (const req of cap.reqs) {
    insertReq.run(caps[cap.key], req);
  }
}

// Fourth pass: link task groups (as slug prefixes for now)
for (const cap of capData) {
  for (const group of cap.taskGroups) {
    // Store group as a task slug reference (e.g., "A0", "A1")
    insertTask.run(caps[cap.key], group);
  }
}

console.log('\nSeed complete:');
console.log(`  Mission: Mindspace Control Plane v1.0`);
console.log(`  Capabilities: ${capData.length}`);
console.log(`  Requirement links: ${capData.reduce((sum, c) => sum + c.reqs.length, 0)}`);
console.log(`  Task group links: ${capData.reduce((sum, c) => sum + c.taskGroups.length, 0)}`);

db.close();
