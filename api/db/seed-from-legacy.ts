import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { getDb } from './connection.js';

/**
 * Migrate legacy mindspace_nodes data from xpollination.db to the new API schema.
 * - Creates default mission "XPollination Platform"
 * - Maps distinct group values to capabilities
 * - Migrates tasks with dna_json preserved
 * - Links tasks to capabilities via capability_tasks junction
 * - Creates "uncategorized" capability for tasks with null/unknown group
 *
 * Reads legacy DB read-only. Safe to run multiple times (INSERT OR IGNORE).
 */
export function seedFromLegacy(legacyDbPath: string, projectSlug: string = 'xpollination-mcp-server'): void {
  const legacyDb = new Database(legacyDbPath, { readonly: true });
  const apiDb = getDb();

  try {
    // Get admin user (thomas)
    const adminUser = apiDb.prepare("SELECT id FROM users WHERE email LIKE '%thomas%' OR name LIKE '%thomas%'").get() as any;
    if (!adminUser) {
      console.error('No admin user found — run seed.ts first');
      return;
    }
    const adminUserId = adminUser.id;

    // Ensure project exists
    apiDb.prepare(
      'INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), projectSlug, 'XPollination MCP Server', 'Content pipeline and PM tool', adminUserId);

    // Get project for FK
    const project = apiDb.prepare('SELECT id, slug FROM projects WHERE slug = ?').get(projectSlug) as any;
    if (!project) {
      console.error(`Project ${projectSlug} not found`);
      return;
    }

    // Create default mission
    const missionId = randomUUID();
    apiDb.prepare(
      'INSERT OR IGNORE INTO missions (id, title, description) VALUES (?, ?, ?)'
    ).run(missionId, 'XPollination Platform', 'Main mission for XPollination platform development');

    // Get actual mission ID (may already exist)
    const mission = apiDb.prepare("SELECT id FROM missions WHERE title = 'XPollination Platform'").get() as any;
    const actualMissionId = mission ? mission.id : missionId;

    // Read all legacy nodes
    const nodes = legacyDb.prepare('SELECT * FROM mindspace_nodes').all() as any[];
    console.log(`Found ${nodes.length} legacy nodes to migrate`);

    // Extract distinct groups and create capabilities
    const capMap: Record<string, string> = {};
    const groups = new Set<string>();
    for (const node of nodes) {
      const dna = node.dna_json ? JSON.parse(node.dna_json) : {};
      const group = dna.group || null;
      if (group) groups.add(group);
    }

    // Create uncategorized capability for tasks without groups
    const uncategorizedId = randomUUID();
    apiDb.prepare(
      'INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status) VALUES (?, ?, ?, ?, ?)'
    ).run(uncategorizedId, actualMissionId, 'uncategorized', 'Tasks without a group assignment', 'active');
    const uncatRow = apiDb.prepare("SELECT id FROM capabilities WHERE title = 'uncategorized' AND mission_id = ?").get(actualMissionId) as any;
    capMap['__uncategorized__'] = uncatRow ? uncatRow.id : uncategorizedId;

    // Create capabilities from distinct group values
    for (const group of groups) {
      const capId = randomUUID();
      apiDb.prepare(
        'INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status) VALUES (?, ?, ?, ?, ?)'
      ).run(capId, actualMissionId, group, `Capability for group ${group}`, 'active');
      const row = apiDb.prepare("SELECT id FROM capabilities WHERE title = ? AND mission_id = ?").get(group, actualMissionId) as any;
      capMap[group] = row ? row.id : capId;
    }
    console.log(`Created ${groups.size} capabilities + 1 uncategorized`);

    // Migrate tasks
    let migrated = 0;
    let linked = 0;
    for (const node of nodes) {
      const dna = node.dna_json ? JSON.parse(node.dna_json) : {};
      const title = dna.title || node.slug;
      const description = dna.description || null;
      // Map legacy statuses to valid CHECK constraint values
      const validStatuses = ['pending', 'ready', 'active', 'review', 'approval', 'approved', 'testing', 'rework', 'blocked', 'complete'];
      const rawStatus = node.status || 'pending';
      const status = validStatuses.includes(rawStatus) ? rawStatus : 'complete';
      const currentRole = dna.role || null;

      const result = apiDb.prepare(
        `INSERT OR IGNORE INTO tasks (id, project_slug, slug, title, description, status, current_role, dna_json, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        node.id, projectSlug, node.slug,
        title, description, status, currentRole,
        node.dna_json, node.created_at, node.updated_at, adminUserId
      );

      if (result.changes > 0) migrated++;

      // Link to capability via capability_tasks
      const group = dna.group || null;
      const capId = group && capMap[group] ? capMap[group] : capMap['__uncategorized__'];
      if (capId) {
        apiDb.prepare(
          'INSERT OR IGNORE INTO capability_tasks (capability_id, task_slug) VALUES (?, ?)'
        ).run(capId, node.slug);
        linked++;
      }
    }

    console.log(`Migrated ${migrated} tasks, linked ${linked} to capabilities`);
  } finally {
    legacyDb.close();
  }
}

// CLI entry point
if (process.argv[1]?.includes('seed-from-legacy')) {
  const legacyPath = process.argv[2] || './data/xpollination.db';
  console.log(`Migrating legacy data from ${legacyPath}...`);
  seedFromLegacy(legacyPath);
  console.log('Legacy migration complete');
}
