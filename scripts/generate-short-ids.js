#!/usr/bin/env node
/**
 * Generate 8-char Base62 short_ids for all existing hierarchy nodes.
 * Idempotent: only generates for nodes WHERE short_id IS NULL.
 *
 * Usage: node scripts/generate-short-ids.js
 * Requires: better-sqlite3, crypto
 */

import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import path from 'path';

const WORKSPACE = process.env.XPO_WORKSPACE_PATH || '/home/developer/workspaces/github/PichlerThomas';
const DB_PATH = process.env.DATABASE_PATH || path.join(WORKSPACE, 'xpollination-mcp-server/data/xpollination.db');

const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateBase62(length = 8) {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62[bytes[i] % 62];
  }
  return result;
}

function generateUniqueShortId(db, existingIds) {
  let id;
  let attempts = 0;
  do {
    id = generateBase62(8);
    attempts++;
    if (attempts > 100) throw new Error('Too many collision attempts');
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

function main() {
  const db = new Database(DB_PATH);
  console.log('Generating short_ids for hierarchy nodes...\n');

  // Collect all existing short_ids to prevent collisions
  const existingIds = new Set();
  for (const table of ['missions', 'capabilities', 'requirements']) {
    try {
      const rows = db.prepare(`SELECT short_id FROM ${table} WHERE short_id IS NOT NULL`).all();
      rows.forEach(r => existingIds.add(r.short_id));
    } catch (e) { /* column may not exist yet */ }
  }

  const TABLES = [
    { name: 'missions', idCol: 'id' },
    { name: 'capabilities', idCol: 'id' },
    { name: 'requirements', idCol: 'id' },
  ];

  let total = 0;
  for (const table of TABLES) {
    const rows = db.prepare(`SELECT ${table.idCol} as id FROM ${table.name} WHERE short_id IS NULL`).all();
    const updateStmt = db.prepare(`UPDATE ${table.name} SET short_id = ? WHERE ${table.idCol} = ?`);

    for (const row of rows) {
      const shortId = generateUniqueShortId(db, existingIds);
      updateStmt.run(shortId, row.id);
      total++;
    }
    console.log(`  ${table.name}: ${rows.length} nodes updated`);
  }

  db.close();
  console.log(`\nTotal: ${total} short_ids generated`);
}

main();
