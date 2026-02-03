#!/usr/bin/env node
/**
 * Export mindspace_nodes from SQLite to JSON for visualization
 * Usage: node export-data.js
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'xpollination.db');
const outputPath = path.join(__dirname, 'data.json');

const db = new Database(dbPath, { readonly: true });

const nodes = db.prepare(`
  SELECT
    id,
    slug,
    type,
    status,
    parent_ids,
    dna_json,
    created_at,
    updated_at
  FROM mindspace_nodes
  ORDER BY created_at ASC
`).all();

// Parse JSON fields
const parsedNodes = nodes.map(node => ({
  ...node,
  parent_ids: node.parent_ids ? JSON.parse(node.parent_ids) : [],
  dna: node.dna_json ? JSON.parse(node.dna_json) : {}
}));

const output = {
  exported_at: new Date().toISOString(),
  node_count: parsedNodes.length,
  nodes: parsedNodes
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Exported ${parsedNodes.length} nodes to ${outputPath}`);

db.close();
