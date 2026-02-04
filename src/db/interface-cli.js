#!/usr/bin/env node
/**
 * Database Interface CLI
 *
 * Regulated access to PM system database for agents.
 * Provides controlled operations with validation.
 *
 * Usage:
 *   node src/db/interface-cli.js <command> [args...]
 *
 * Commands:
 *   get <id|slug>                    - Get node by ID or slug
 *   list [--status=X] [--type=Y] [--role=Z]  - List nodes with filters
 *   transition <id> <newStatus> <actor>       - Change node status
 *   update-dna <id> <dnaJson> <actor>         - Update node DNA
 *   create <type> <slug> <dnaJson> <actor>    - Create new node
 *
 * Actors: dev, pdsa, qa, liaison, orchestrator, system
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Valid statuses (no 'd' in complete!)
const VALID_STATUSES = ['pending', 'ready', 'active', 'review', 'rework', 'complete', 'blocked', 'cancelled'];

// Valid actors
const VALID_ACTORS = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'];

// Actor permissions matrix
const PERMISSIONS = {
  dev: {
    read: true,
    create: false,
    updateDna: true,
    transitions: ['active->review', 'ready->active']
  },
  pdsa: {
    read: true,
    create: true,
    updateDna: true,
    transitions: ['pending->ready', 'ready->active', 'active->review', 'review->complete', 'review->rework', 'rework->ready']
  },
  qa: {
    read: true,
    create: false,
    updateDna: true, // review fields only
    transitions: ['review->complete', 'review->rework']
  },
  liaison: {
    read: true,
    create: true,
    updateDna: true,
    transitions: 'all'
  },
  orchestrator: {
    read: true,
    create: false,
    updateDna: false,
    transitions: []
  },
  system: {
    read: true,
    create: true,
    updateDna: true,
    transitions: 'all'
  }
};

function getDb() {
  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/xpollination.db');
  return new Database(dbPath);
}

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

function error(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function checkPermission(actor, operation, extra = null) {
  if (!VALID_ACTORS.includes(actor)) {
    error(`Invalid actor: ${actor}. Valid: ${VALID_ACTORS.join(', ')}`);
  }

  const perms = PERMISSIONS[actor];

  if (operation === 'read' && !perms.read) {
    error(`Actor "${actor}" not allowed to read`);
  }
  if (operation === 'create' && !perms.create) {
    error(`Actor "${actor}" not allowed to create nodes`);
  }
  if (operation === 'updateDna' && !perms.updateDna) {
    error(`Actor "${actor}" not allowed to update DNA`);
  }
  if (operation === 'transition') {
    const transition = extra; // "fromStatus->toStatus"
    if (perms.transitions !== 'all' && !perms.transitions.includes(transition)) {
      error(`Actor "${actor}" not allowed transition: ${transition}`);
    }
  }
}

// Commands

function cmdGet(idOrSlug) {
  const db = getDb();

  // Try by ID first, then by slug
  let node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ?').get(idOrSlug);
  if (!node) {
    node = db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?').get(idOrSlug);
  }

  if (!node) {
    error(`Node not found: ${idOrSlug}`);
  }

  // Parse JSON fields
  node.dna = JSON.parse(node.dna_json);
  node.parent_ids = node.parent_ids ? JSON.parse(node.parent_ids) : [];
  delete node.dna_json;

  output(node);
  db.close();
}

function cmdList(filters) {
  const db = getDb();

  let query = 'SELECT * FROM mindspace_nodes WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.role) {
    query += ` AND json_extract(dna_json, '$.role') = ?`;
    params.push(filters.role);
  }

  query += ' ORDER BY updated_at DESC';

  const nodes = db.prepare(query).all(...params);

  // Parse JSON fields
  const result = nodes.map(node => ({
    id: node.id,
    type: node.type,
    status: node.status,
    slug: node.slug,
    title: JSON.parse(node.dna_json).title || node.slug,
    role: JSON.parse(node.dna_json).role || null,
    updated_at: node.updated_at
  }));

  output({ count: result.length, nodes: result });
  db.close();
}

function cmdTransition(id, newStatus, actor) {
  if (!VALID_STATUSES.includes(newStatus)) {
    error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}`);
  }

  const db = getDb();

  // Get current node
  const node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ? OR slug = ?').get(id, id);
  if (!node) {
    error(`Node not found: ${id}`);
  }

  const fromStatus = node.status;
  const transition = `${fromStatus}->${newStatus}`;

  checkPermission(actor, 'transition', transition);

  // Perform transition
  db.prepare(`
    UPDATE mindspace_nodes
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, node.id);

  output({
    success: true,
    id: node.id,
    slug: node.slug,
    transition: transition,
    actor: actor
  });

  db.close();
}

function cmdUpdateDna(id, dnaJson, actor) {
  checkPermission(actor, 'updateDna');

  let dna;
  try {
    dna = JSON.parse(dnaJson);
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
  }

  const db = getDb();

  // Get current node
  const node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ? OR slug = ?').get(id, id);
  if (!node) {
    error(`Node not found: ${id}`);
  }

  // Merge DNA (preserve existing fields)
  const existingDna = JSON.parse(node.dna_json);
  const mergedDna = { ...existingDna, ...dna };

  // Update
  db.prepare(`
    UPDATE mindspace_nodes
    SET dna_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(mergedDna), node.id);

  output({
    success: true,
    id: node.id,
    slug: node.slug,
    actor: actor
  });

  db.close();
}

function cmdCreate(type, slug, dnaJson, actor) {
  checkPermission(actor, 'create');

  let dna;
  try {
    dna = JSON.parse(dnaJson);
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
  }

  const db = getDb();

  // Check slug uniqueness
  const existing = db.prepare('SELECT id FROM mindspace_nodes WHERE slug = ?').get(slug);
  if (existing) {
    error(`Slug already exists: ${slug}`);
  }

  const id = randomUUID();

  db.prepare(`
    INSERT INTO mindspace_nodes (id, type, status, slug, dna_json, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
  `).run(id, type, slug, JSON.stringify(dna));

  output({
    success: true,
    id: id,
    slug: slug,
    type: type,
    status: 'pending',
    actor: actor
  });

  db.close();
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`
Database Interface CLI - Regulated PM System Access

Usage:
  node src/db/interface-cli.js <command> [args...]

Commands:
  get <id|slug>                              Get node by ID or slug
  list [--status=X] [--type=Y] [--role=Z]    List nodes with filters
  transition <id> <newStatus> <actor>        Change node status
  update-dna <id> <dnaJson> <actor>          Update node DNA (merge)
  create <type> <slug> <dnaJson> <actor>     Create new node

Status values: ${VALID_STATUSES.join(', ')}
Actors: ${VALID_ACTORS.join(', ')}

Examples:
  node src/db/interface-cli.js get my-task-slug
  node src/db/interface-cli.js list --status=ready --role=dev
  node src/db/interface-cli.js transition my-task active dev
  node src/db/interface-cli.js update-dna my-task '{"response":"done"}' pdsa
`);
  process.exit(0);
}

switch (command) {
  case 'get':
    if (!args[1]) error('Usage: get <id|slug>');
    cmdGet(args[1]);
    break;

  case 'list': {
    const filters = {};
    for (let i = 1; i < args.length; i++) {
      const match = args[i].match(/^--(\w+)=(.+)$/);
      if (match) {
        filters[match[1]] = match[2];
      }
    }
    cmdList(filters);
    break;
  }

  case 'transition':
    if (!args[1] || !args[2] || !args[3]) {
      error('Usage: transition <id|slug> <newStatus> <actor>');
    }
    cmdTransition(args[1], args[2], args[3]);
    break;

  case 'update-dna':
    if (!args[1] || !args[2] || !args[3]) {
      error('Usage: update-dna <id|slug> <dnaJson> <actor>');
    }
    cmdUpdateDna(args[1], args[2], args[3]);
    break;

  case 'create':
    if (!args[1] || !args[2] || !args[3] || !args[4]) {
      error('Usage: create <type> <slug> <dnaJson> <actor>');
    }
    cmdCreate(args[1], args[2], args[3], args[4]);
    break;

  default:
    error(`Unknown command: ${command}`);
}
