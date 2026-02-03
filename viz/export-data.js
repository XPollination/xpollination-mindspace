#!/usr/bin/env node
/**
 * Export mindspace_nodes and stations from SQLite to JSON for visualization
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

// Export nodes
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

// Export stations
const stations = db.prepare(`
  SELECT
    id,
    role,
    name,
    agent_id,
    current_object_id,
    status,
    created_at
  FROM stations
  ORDER BY role
`).all();

// Count objects by status
const queueCount = parsedNodes.filter(n => n.status === 'pending' || n.status === 'ready').length;
const activeCount = parsedNodes.filter(n => n.status === 'active').length;
const completedCount = parsedNodes.filter(n => n.status === 'completed' || n.status === 'done').length;

const output = {
  exported_at: new Date().toISOString(),
  node_count: parsedNodes.length,
  queue_count: queueCount,
  active_count: activeCount,
  completed_count: completedCount,
  stations: stations,
  nodes: parsedNodes
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Exported ${parsedNodes.length} nodes, ${stations.length} stations to ${outputPath}`);

db.close();
