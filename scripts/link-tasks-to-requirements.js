#!/usr/bin/env node
/**
 * Link existing tasks to requirements via requirement_refs in DNA.
 * Maps task groups to requirement IDs and updates DNA with merge logic.
 * Uses direct DB access for bulk metadata updates (including complete tasks).
 *
 * Usage: node scripts/link-tasks-to-requirements.js
 * Requires: better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';

const WORKSPACE = process.env.XPO_WORKSPACE_PATH || '/home/developer/workspaces/github/PichlerThomas';
const DB_PATH = process.env.DATABASE_PATH || path.join(WORKSPACE, 'xpollination-mcp-server/data/xpollination.db');

// Group-to-requirement mapping (from DNA group field)
const GROUP_MAPPING = {
  'AUTH': ['REQ-AUTH-001', 'REQ-AUTH-002'],
  'WORKFLOW': ['REQ-WF-001', 'REQ-WF-002'],
  'WF': ['REQ-WF-001', 'REQ-WF-002'],
  'A2A': ['REQ-A2A-001', 'REQ-A2A-002'],
  'INFRA': ['REQ-INFRA-001', 'REQ-INFRA-002'],
  'VIZ': ['REQ-VIZ-001', 'REQ-VIZ-002'],
  'HIERARCHY': ['REQ-GRAPH-001', 'REQ-GRAPH-002'],
};

// Slug-contains patterns for broader matching
const SLUG_MAPPING = {
  'graph-': ['REQ-GRAPH-001', 'REQ-GRAPH-002'],
  'ms-auth': ['REQ-AUTH-001', 'REQ-AUTH-002'],
  'ms-wf': ['REQ-WF-001', 'REQ-WF-002'],
  'ms-a2a': ['REQ-A2A-001', 'REQ-A2A-002'],
  'ms-api': ['REQ-INFRA-001', 'REQ-INFRA-002'],
  'ms-hierarchy': ['REQ-GRAPH-001', 'REQ-GRAPH-002'],
  'h1-': ['REQ-VIZ-001', 'REQ-VIZ-002'],
};

function getRequirementsForTask(slug, group) {
  const refs = [];

  // Match by group field
  if (group && GROUP_MAPPING[group]) {
    refs.push(...GROUP_MAPPING[group]);
  }

  // Match by slug prefix
  for (const [prefix, reqs] of Object.entries(SLUG_MAPPING)) {
    if (slug && slug.startsWith(prefix)) {
      refs.push(...reqs);
    }
  }

  // Deduplicate using Set
  return [...new Set(refs)];
}

function mergeRequirementRefs(existing, newRefs) {
  // Merge existing requirement_refs with new ones, preserving existing
  const merged = new Set(existing || []);
  for (const ref of newRefs) {
    merged.add(ref);
  }
  return [...merged];
}

function main() {
  console.log('Linking tasks to requirements...\n');

  const db = new Database(DB_PATH);
  const tasks = db.prepare("SELECT slug, dna_json FROM mindspace_nodes WHERE type = 'task'").all();

  const updateStmt = db.prepare(
    "UPDATE mindspace_nodes SET dna_json = ? WHERE slug = ?"
  );

  let linked = 0;
  let skipped = 0;
  const summary = {};

  for (const task of tasks) {
    let dna;
    try {
      dna = JSON.parse(task.dna_json);
    } catch { skipped++; continue; }

    const group = dna.group;
    const newRefs = getRequirementsForTask(task.slug, group);
    if (newRefs.length === 0) {
      skipped++;
      continue;
    }

    const existingRefs = dna.requirement_refs || [];
    const merged = mergeRequirementRefs(existingRefs, newRefs);

    // Skip if no new refs to add
    if (merged.length === existingRefs.length && merged.every(r => existingRefs.includes(r))) {
      skipped++;
      continue;
    }

    // Update DNA with merged requirement_refs using interface-cli update-dna pattern
    dna.requirement_refs = merged;
    updateStmt.run(JSON.stringify(dna), task.slug);
    linked++;
    console.log(`  ${task.slug} → ${merged.join(', ')}`);
    for (const ref of merged) {
      summary[ref] = (summary[ref] || 0) + 1;
    }
  }

  db.close();

  console.log(`\n--- Summary ---`);
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`Linked: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`\nRequirement distribution:`);
  for (const [ref, count] of Object.entries(summary).sort()) {
    console.log(`  ${ref}: ${count} tasks`);
  }
}

main();
