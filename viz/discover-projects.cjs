#!/usr/bin/env node
// discover-projects.cjs — shared project discovery module
// Single source of truth for finding xpollination projects in workspace.
// All consumers (server.js, agent-monitor.cjs, pm-status.cjs) use this module.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DEFAULT_WORKSPACE = '/home/developer/workspaces/github/PichlerThomas';

/**
 * Discover all projects with data/xpollination.db in the workspace.
 * Uses XPO_WORKSPACE_PATH env var, falls back to default.
 * Filters out zero-byte ghost databases.
 *
 * @param {string} [workspacePath] - Override workspace path (defaults to env/default)
 * @returns {Array<{name: string, path: string, dbPath: string}>}
 */
function discoverProjects(workspacePath) {
  const workspace = workspacePath || process.env.XPO_WORKSPACE_PATH || DEFAULT_WORKSPACE;
  const projects = [];

  try {
    const dirs = fs.readdirSync(workspace);

    for (const dir of dirs) {
      const projectPath = path.join(workspace, dir);
      const dbPath = path.join(projectPath, 'data', 'xpollination.db');

      try {
        const dirStat = fs.statSync(projectPath);
        if (!dirStat.isDirectory()) continue;
      } catch { continue; }

      if (fs.existsSync(dbPath)) {
        // Filter ghost projects: skip zero-byte databases
        try {
          const dbStat = fs.statSync(dbPath);
          if (dbStat.size === 0) continue;
        } catch { continue; }

        // Validate DB has mindspace_nodes table
        try {
          const db = new Database(dbPath, { readonly: true });
          const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mindspace_nodes'").get();
          db.close();
          if (!table) {
            // DB exists but has no mindspace_nodes — skip this project
            continue;
          }
        } catch { continue; }

        projects.push({
          name: dir,
          path: projectPath,
          dbPath: dbPath
        });
      }
    }
  } catch (err) {
    console.error('Error discovering projects:', err.message);
  }

  return projects;
}

module.exports = { discoverProjects };
