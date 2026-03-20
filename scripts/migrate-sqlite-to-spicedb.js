#!/usr/bin/env node
/**
 * Migrate SQLite node_relationships to SpiceDB tuples
 * Usage: node scripts/migrate-sqlite-to-spicedb.js [--dry-run]
 *
 * Reads COMPOSES and IMPLEMENTS relationships from node_relationships table
 * and writes them as SpiceDB tuples via the authzed-node client.
 */

import Database from 'better-sqlite3';
import { createClient } from '../src/spicedb/client.js';

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = process.env.DATABASE_PATH || 'data/xpollination.db';

async function migrate() {
  const db = new Database(DB_PATH, { readonly: true });

  const relationships = db.prepare(
    "SELECT source_type, source_id, relation, target_type, target_id FROM node_relationships"
  ).all();

  console.log(`Found ${relationships.length} relationships to migrate`);

  if (DRY_RUN) {
    for (const r of relationships) {
      console.log(`  [dry-run] ${r.source_type}:${r.source_id}#${r.relation}@${r.target_type}:${r.target_id}`);
    }
    console.log('Dry run complete — no tuples written');
    db.close();
    return;
  }

  const client = createClient();
  let written = 0;
  let errors = 0;

  for (const r of relationships) {
    try {
      await client.writeRelationship(
        r.source_type, r.source_id,
        r.relation.toLowerCase(),
        r.target_type, r.target_id
      );
      written++;
    } catch (err) {
      console.error(`Error writing ${r.source_type}:${r.source_id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Migration complete: ${written} written, ${errors} errors`);
  db.close();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
