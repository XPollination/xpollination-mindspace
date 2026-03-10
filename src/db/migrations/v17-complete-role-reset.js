#!/usr/bin/env node
/**
 * Migration v17: Fix historical complete/cancelled tasks with wrong role
 *
 * Per WORKFLOW.md v17: complete and cancelled states must have role=liaison.
 * This one-time migration fixes 69+ historical tasks that have wrong roles
 * (qa, dev, pdsa, or null).
 *
 * Usage:
 *   DATABASE_PATH=./data/xpollination.db node src/db/migrations/v17-complete-role-reset.js
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../../data/xpollination.db');
const db = new Database(dbPath);

// Count affected rows before fix
const before = db.prepare(`
  SELECT COUNT(*) as count FROM mindspace_nodes
  WHERE status IN ('complete', 'cancelled')
  AND (json_extract(dna_json, '$.role') != 'liaison' OR json_extract(dna_json, '$.role') IS NULL)
`).get();

console.log(`Found ${before.count} complete/cancelled tasks with wrong role`);

// Fix: set role=liaison for all complete and cancelled tasks
const result = db.prepare(`
  UPDATE mindspace_nodes
  SET dna_json = json_set(dna_json, '$.role', 'liaison'),
      updated_at = datetime('now')
  WHERE status IN ('complete', 'cancelled')
  AND (json_extract(dna_json, '$.role') != 'liaison' OR json_extract(dna_json, '$.role') IS NULL)
`).run();

console.log(`Updated ${result.changes} tasks to role=liaison`);

// Verify
const after = db.prepare(`
  SELECT COUNT(*) as count FROM mindspace_nodes
  WHERE status IN ('complete', 'cancelled')
  AND (json_extract(dna_json, '$.role') != 'liaison' OR json_extract(dna_json, '$.role') IS NULL)
`).get();

console.log(`Remaining tasks with wrong role: ${after.count}`);

db.close();
