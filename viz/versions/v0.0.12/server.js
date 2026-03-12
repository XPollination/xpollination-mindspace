#!/usr/bin/env node
/**
 * Visualization server with multi-project support
 * Usage: node viz/server.js [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.argv[2]) || 3000;
const WORKSPACE_PATH = process.env.XPO_WORKSPACE_PATH || '/home/developer/workspaces/github/PichlerThomas';

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

/**
 * Discover projects with xpollination.db in workspace
 */
function discoverProjects() {
  const projects = [];

  try {
    const dirs = fs.readdirSync(WORKSPACE_PATH);

    for (const dir of dirs) {
      const projectPath = path.join(WORKSPACE_PATH, dir);
      const dbPath = path.join(projectPath, 'data', 'xpollination.db');

      // Skip if not a directory
      const stat = fs.statSync(projectPath);
      if (!stat.isDirectory()) continue;

      // Check if db exists
      if (fs.existsSync(dbPath)) {
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

/**
 * Export data from a project's database
 */
function exportProjectData(dbPath) {
  const db = new Database(dbPath, { readonly: true });

  try {
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
    const postWorkStatuses = ['complete', 'completed', 'done', 'review', 'rework', 'blocked', 'cancelled'];
    const completedCount = parsedNodes.filter(n => postWorkStatuses.includes(n.status)).length;

    return {
      exported_at: new Date().toISOString(),
      node_count: parsedNodes.length,
      queue_count: queueCount,
      active_count: activeCount,
      completed_count: completedCount,
      stations: stations,
      nodes: parsedNodes
    };
  } finally {
    db.close();
  }
}

/**
 * Serve static file
 */
function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

/**
 * Send JSON response
 */
function sendJson(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Handle HTTP requests
 */
/**
 * Read request body as JSON
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Get or create system_settings table, return DB handle (writable)
 */
function getSettingsDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS system_settings_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO system_settings (key, value, updated_by) VALUES ('liaison_approval_mode', 'manual', 'system');
  `);
  return db;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API: List projects
  if (pathname === '/api/projects') {
    const projects = discoverProjects();
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    sendJson(res, {
      current: currentProject,
      projects: projects.map(p => ({ name: p.name, path: p.path }))
    });
    return;
  }

  // API: Get project data
  if (pathname === '/api/data') {
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();

    // All Projects: merge data from all discovered databases
    if (projectName === 'all') {
      try {
        const mergedNodes = [];
        const mergedStations = [];
        let totalQueue = 0, totalActive = 0, totalCompleted = 0;

        for (const proj of projects) {
          try {
            const data = exportProjectData(proj.dbPath);
            // Tag each node with project name
            for (const node of data.nodes) {
              if (!node.dna) node.dna = {};
              node.dna._project = proj.name;
              mergedNodes.push(node);
            }
            // Prefix station IDs to avoid collision
            for (const s of data.stations) {
              s.id = `${proj.name}:${s.id}`;
              s.name = `${s.name} (${proj.name})`;
              mergedStations.push(s);
            }
            totalQueue += data.queue_count;
            totalActive += data.active_count;
            totalCompleted += data.completed_count;
          } catch (err) {
            console.error(`Skipping project ${proj.name}:`, err.message);
          }
        }

        sendJson(res, {
          exported_at: new Date().toISOString(),
          project: 'All Projects',
          node_count: mergedNodes.length,
          queue_count: totalQueue,
          active_count: totalActive,
          completed_count: totalCompleted,
          stations: mergedStations,
          nodes: mergedNodes
        });
      } catch (err) {
        sendJson(res, { error: err.message }, 500);
      }
      return;
    }

    let targetProject;
    if (projectName) {
      targetProject = projects.find(p => p.name === projectName);
    } else {
      // Default to current project
      const currentName = path.basename(__dirname.replace('/viz', ''));
      targetProject = projects.find(p => p.name === currentName);
    }

    if (!targetProject) {
      sendJson(res, { error: 'Project not found' }, 404);
      return;
    }

    try {
      const data = exportProjectData(targetProject.dbPath);
      data.project = targetProject.name;
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  // API: Get current viz version from active symlink
  if (pathname === '/api/version' && req.method === 'GET') {
    try {
      // Try viz/active relative to cwd first (for systemd/symlink-based deployment),
      // then fall back to __dirname/active (for direct execution from viz/)
      const cwdActivePath = path.join(process.cwd(), 'viz', 'active');
      const dirActivePath = path.join(__dirname, 'active');
      const activePath = fs.existsSync(cwdActivePath) ? cwdActivePath : dirActivePath;
      const target = fs.readlinkSync(activePath);
      const versionMatch = target.match(/v(\d+\.\d+\.\d+)/);
      sendJson(res, { version: versionMatch ? `v${versionMatch[1]}` : target });
    } catch (e) {
      sendJson(res, { version: null, error: 'Could not read active symlink' });
    }
    return;
  }

  // API: Get changelog for specific version
  const changelogMatch = pathname.match(/^\/api\/changelog\/(.+)$/);
  if (changelogMatch && req.method === 'GET') {
    const version = changelogMatch[1];
    const changelogPath = path.join(__dirname, 'versions', version, 'changelog.json');
    try {
      const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'));
      sendJson(res, changelog);
    } catch (e) {
      sendJson(res, { error: `Changelog not found for ${version}` }, 404);
    }
    return;
  }

  // API: Get all changelogs across versions
  if (pathname === '/api/changelogs' && req.method === 'GET') {
    const versionsDir = path.join(__dirname, 'versions');
    const changelogs = [];
    try {
      const dirs = fs.readdirSync(versionsDir).filter(d => d.startsWith('v')).sort().reverse();
      for (const dir of dirs) {
        const changelogPath = path.join(versionsDir, dir, 'changelog.json');
        if (fs.existsSync(changelogPath)) {
          changelogs.push(JSON.parse(fs.readFileSync(changelogPath, 'utf-8')));
        }
      }
    } catch (e) { /* ignore */ }
    sendJson(res, { changelogs });
    return;
  }

  // API: Get LIAISON approval mode
  if (pathname === '/api/settings/liaison-approval-mode' && req.method === 'GET') {
    const projects = discoverProjects();
    // Use first project DB for global settings
    const dbPath = projects[0]?.dbPath;
    if (!dbPath) {
      sendJson(res, { error: 'No project database found' }, 500);
      return;
    }
    const db = getSettingsDb(dbPath);
    try {
      const row = db.prepare("SELECT value, updated_by, updated_at FROM system_settings WHERE key = 'liaison_approval_mode'").get();
      sendJson(res, {
        mode: row?.value || 'manual',
        updated_by: row?.updated_by || 'system',
        updated_at: row?.updated_at || null,
      });
    } finally {
      db.close();
    }
    return;
  }

  // API: Set LIAISON approval mode
  if (pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      if (!body.mode || !['manual', 'semi', 'auto-approval', 'auto'].includes(body.mode)) {
        sendJson(res, { error: 'Invalid mode. Must be "manual", "semi", "auto-approval", or "auto".' }, 400);
        return;
      }
      const projects = discoverProjects();
      if (projects.length === 0) {
        sendJson(res, { error: 'No project database found' }, 500);
        return;
      }
      // Write setting to ALL project DBs (global setting must be visible from any task DB)
      const actor = body.actor || body.updated_by || 'viz-ui';
      let lastRow = null;
      for (const proj of projects) {
        const db = getSettingsDb(proj.dbPath);
        try {
          // Read old value for audit
          const oldRow = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
          const oldValue = oldRow?.value || null;

          // Insert audit record
          db.prepare("INSERT INTO system_settings_audit (key, old_value, new_value, changed_by, changed_at) VALUES ('liaison_approval_mode', ?, ?, ?, datetime('now'))").run(oldValue, body.mode, actor);

          // Update setting
          db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at) VALUES ('liaison_approval_mode', ?, ?, datetime('now'))").run(body.mode, actor);
          lastRow = db.prepare("SELECT value, updated_by, updated_at FROM system_settings WHERE key = 'liaison_approval_mode'").get();
        } finally {
          db.close();
        }
      }
      console.error(`[SETTINGS] liaison_approval_mode changed: ${lastRow.value} by ${actor}`);
      sendJson(res, {
        mode: lastRow.value,
        updated_by: lastRow.updated_by,
        updated_at: lastRow.updated_at,
        synced_to: projects.map(p => p.name),
      });
    } catch (e) {
      sendJson(res, { error: e.message }, 400);
    }
    return;
  }

  // API: Confirm task (set human_confirmed in DNA)
  const confirmMatch = pathname.match(/^\/api\/node\/([^/]+)\/confirm$/);
  if (confirmMatch && req.method === 'PUT') {
    try {
      const slug = confirmMatch[1];
      const body = await readBody(req);
      const projectName = body.project;

      const projects = discoverProjects();
      const targetProject = projectName
        ? projects.find(p => p.name === projectName)
        : projects[0];

      if (!targetProject) {
        sendJson(res, { error: `Project not found: ${projectName}` }, 404);
        return;
      }

      const db = new Database(targetProject.dbPath);
      try {
        const node = db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?').get(slug);
        if (!node) {
          sendJson(res, { error: `Task not found: ${slug}` }, 404);
          return;
        }

        const dna = JSON.parse(node.dna_json || '{}');
        dna.human_confirmed = true;
        dna.human_confirmed_via = 'viz';

        db.prepare('UPDATE mindspace_nodes SET dna_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(dna), node.id);

        sendJson(res, {
          success: true,
          slug: node.slug,
          status: node.status,
          human_confirmed: true,
          human_confirmed_via: 'viz',
        });
      } finally {
        db.close();
      }
    } catch (e) {
      sendJson(res, { error: e.message }, 400);
    }
    return;
  }

  // API: Rework task — PUT /api/node/:slug/rework (set rework_reason in DNA)
  const reworkMatch = pathname.match(/^\/api\/node\/([^/]+)\/rework$/);
  if (reworkMatch && req.method === 'PUT') {
    try {
      const slug = reworkMatch[1];
      const body = await readBody(req);
      const projectName = body.project;

      const projects = discoverProjects();
      const targetProject = projectName
        ? projects.find(p => p.name === projectName)
        : projects[0];

      if (!targetProject) {
        sendJson(res, { error: `Project not found: ${projectName}` }, 404);
        return;
      }

      const db = new Database(targetProject.dbPath);
      try {
        const node = db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?').get(slug);
        if (!node) {
          sendJson(res, { error: `Task not found: ${slug}` }, 404);
          return;
        }

        const dna = JSON.parse(node.dna_json || '{}');
        dna.rework_reason = body.rework_reason || body.reason || 'No reason provided';
        dna.human_confirmed = false;

        db.prepare('UPDATE mindspace_nodes SET dna_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(JSON.stringify(dna), node.id);

        sendJson(res, {
          success: true,
          slug: node.slug,
          status: node.status,
          rework_reason: dna.rework_reason,
        });
      } finally {
        db.close();
      }
    } catch (e) {
      sendJson(res, { error: e.message }, 400);
    }
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStatic(res, filePath);
});

const BIND_HOST = process.env.VIZ_BIND || undefined;
server.listen(PORT, BIND_HOST, () => {
  const host = BIND_HOST || '0.0.0.0';
  console.log(`Viz server running at http://${host}:${PORT}`);
  console.log(`Workspace: ${WORKSPACE_PATH}`);
  const projects = discoverProjects();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);
});
