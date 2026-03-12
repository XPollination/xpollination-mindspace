#!/usr/bin/env node
/**
 * Visualization server with multi-project support
 * Usage: node viz/server.js [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { discoverProjects } = require('./discover-projects.cjs');

const PORT = parseInt(process.argv[2]) || 3000;

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp'
};

/**
 * DNA-lite: strip heavy fields, keep essentials for Kanban view
 */
const LITE_FIELDS = ['title', 'role', 'description', 'depends_on', 'group', 'environment', 'priority', '_project'];
function toLiteDna(dnaJson) {
  const dna = typeof dnaJson === 'string' ? JSON.parse(dnaJson) : dnaJson;
  if (!dna) return {};
  const lite = {};
  for (const key of LITE_FIELDS) {
    if (dna[key] !== undefined) {
      lite[key] = key === 'description' ? (dna[key] || '').substring(0, 200) : dna[key];
    }
  }
  return lite;
}

/**
 * Export data from a project's database
 */
function exportProjectData(dbPath, options) {
  const { since, dnaFull } = options || {};
  const db = new Database(dbPath, { readonly: true });

  try {
    // Check if change_seq column exists
    const cols = db.prepare("PRAGMA table_info(mindspace_nodes)").all();
    const hasChangeSeq = cols.some(c => c.name === 'change_seq');

    // Export nodes — incremental if since is provided and change_seq exists
    let query;
    let queryParams = [];
    if (since && hasChangeSeq) {
      query = `SELECT id, slug, type, status, parent_ids, dna_json, created_at, updated_at, change_seq
        FROM mindspace_nodes WHERE updated_at > ? ORDER BY updated_at ASC`;
      queryParams = [since];
    } else {
      const seqCol = hasChangeSeq ? ', change_seq' : '';
      query = `SELECT id, slug, type, status, parent_ids, dna_json, created_at, updated_at${seqCol}
        FROM mindspace_nodes ORDER BY created_at ASC`;
    }
    const nodes = db.prepare(query).all(...queryParams);

    // Parse JSON fields, apply DNA-lite unless dna=full
    const parsedNodes = nodes.map(node => {
      const fullDna = node.dna_json ? JSON.parse(node.dna_json) : {};
      const result = {
        ...node,
        parent_ids: node.parent_ids ? JSON.parse(node.parent_ids) : [],
        dna: dnaFull ? fullDna : toLiteDna(fullDna)
      };
      delete result.dna_json;
      return result;
    });

    // Compute change_seq watermark
    let maxSeq = null;
    if (hasChangeSeq) {
      const row = db.prepare('SELECT MAX(updated_at) as max_updated FROM mindspace_nodes').get();
      maxSeq = row ? row.max_updated : null;
    }

    // Export stations (skip for incremental — rarely change)
    let stations = [];
    if (!since) {
      stations = db.prepare(`
        SELECT id, role, name, agent_id, current_object_id, status, created_at
        FROM stations ORDER BY role
      `).all();
    }

    // Count objects by status (always include for stats)
    const allNodes = since ? db.prepare('SELECT status FROM mindspace_nodes').all() : parsedNodes;
    const queueCount = allNodes.filter(n => n.status === 'pending' || n.status === 'ready').length;
    const activeCount = allNodes.filter(n => n.status === 'active').length;
    const postWorkStatuses = ['complete', 'completed', 'done', 'review', 'rework', 'blocked', 'cancelled'];
    const completedCount = allNodes.filter(n => postWorkStatuses.includes(n.status)).length;

    const result = {
      exported_at: new Date().toISOString(),
      node_count: since ? undefined : parsedNodes.length,
      changed_count: since ? parsedNodes.length : undefined,
      change_seq: maxSeq,
      queue_count: queueCount,
      active_count: activeCount,
      completed_count: completedCount,
      nodes: parsedNodes
    };
    if (!since) {
      result.stations = stations;
    }
    if (since) {
      result.since = since;
      result.deleted_slugs = [];
    }
    return result;
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

  // API: Mission overview (capabilities with progress)
  if (pathname === '/api/mission-overview') {
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();
    const capabilities = [];

    const targetProjects = projectName === 'all' ? projects :
      projects.filter(p => p.name === projectName);

    for (const proj of (targetProjects.length ? targetProjects : projects)) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const caps = db.prepare('SELECT * FROM capabilities').all();
          for (const cap of caps) {
            const taskRows = db.prepare(
              `SELECT t.status FROM capability_tasks ct
               LEFT JOIN mindspace_nodes t ON t.slug = ct.task_slug
               WHERE ct.capability_id = ?`
            ).all(cap.id);
            const task_count = taskRows.length;
            const complete_count = taskRows.filter(t => t.status === 'complete').length;
            const progress_percent = task_count > 0 ? Math.round((complete_count / task_count) * 100) : 0;
            capabilities.push({
              id: cap.id,
              title: cap.title,
              description: cap.description,
              status: cap.status,
              mission_id: cap.mission_id,
              task_count,
              complete_count,
              progress_percent,
              _project: proj.name
            });
          }
        } catch (err) { /* tables may not exist */ }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, { capabilities });
    return;
  }

  // API: Capability detail — GET /api/capabilities/:capId
  if (pathname.match(/^\/api\/capabilities\/([^/]+)$/)) {
    const capId = pathname.split('/')[3];
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();
    const targetProjects = projectName ? projects.filter(p => p.name === projectName) : projects;

    for (const proj of (targetProjects.length ? targetProjects : projects)) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const cap = db.prepare('SELECT * FROM capabilities WHERE id = ?').get(capId);
          if (cap) {
            const requirements = db.prepare(
              `SELECT r.id, r.req_id_human, r.title, r.status, r.priority
               FROM capability_requirements cr
               JOIN requirements r ON r.id = cr.requirement_ref
               WHERE cr.capability_id = ?
               ORDER BY r.req_id_human ASC`
            ).all(capId);

            const tasks = db.prepare(
              `SELECT ct.task_slug, t.id, t.status, t.dna_json
               FROM capability_tasks ct
               LEFT JOIN mindspace_nodes t ON t.slug = ct.task_slug
               WHERE ct.capability_id = ?
               ORDER BY t.status ASC`
            ).all(capId);

            const enrichedTasks = tasks.map(t => {
              const dna = t.dna_json ? JSON.parse(t.dna_json) : {};
              return {
                slug: t.task_slug,
                title: dna.title || t.task_slug,
                status: t.status || 'unknown',
                role: dna.role || null
              };
            });

            db.close();
            sendJson(res, {
              id: cap.id,
              title: cap.title,
              description: cap.description,
              status: cap.status,
              requirements,
              tasks: enrichedTasks,
              task_count: enrichedTasks.length,
              complete_count: enrichedTasks.filter(t => t.status === 'complete').length
            });
            return;
          }
        } catch (err) { /* tables may not exist */ }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, { error: 'Capability not found' }, 404);
    return;
  }

  // API: Suspect links stats
  if (pathname === '/api/suspect-links/stats') {
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();

    const merged = { suspect: 0, cleared: 0, accepted_risk: 0, total: 0, by_source_type: {} };

    const targetProjects = projectName === 'all' ? projects :
      projects.filter(p => p.name === projectName).slice(0, 1);

    if (targetProjects.length === 0 && projectName !== 'all') {
      // Default to current project
      const currentName = path.basename(__dirname.replace('/viz', ''));
      const current = projects.find(p => p.name === currentName);
      if (current) targetProjects.push(current);
    }

    for (const proj of (targetProjects.length ? targetProjects : projects)) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const rows = db.prepare(
            'SELECT status, source_type, COUNT(*) as count FROM suspect_links GROUP BY status, source_type'
          ).all();
          for (const row of rows) {
            if (merged[row.status] !== undefined) merged[row.status] += row.count;
            merged.total += row.count;
            if (!merged.by_source_type[row.source_type]) {
              merged.by_source_type[row.source_type] = { suspect: 0, cleared: 0, accepted_risk: 0 };
            }
            if (merged.by_source_type[row.source_type][row.status] !== undefined) {
              merged.by_source_type[row.source_type][row.status] += row.count;
            }
          }
        } catch (err) {
          // Table doesn't exist in this project — skip
        }
        db.close();
      } catch (err) {
        // DB open error — skip project
      }
    }
    sendJson(res, merged);
    return;
  }

  // API: Get project data
  if (pathname === '/api/data') {
    const projectName = url.searchParams.get('project');
    const since = url.searchParams.get('since');
    const dnaMode = url.searchParams.get('dna');
    const dnaFull = dnaMode === 'full';
    const projects = discoverProjects();

    // All Projects: merge data from all discovered databases
    if (projectName === 'all') {
      try {
        const mergedNodes = [];
        const mergedStations = [];
        let totalQueue = 0, totalActive = 0, totalCompleted = 0;
        let maxChangeSeq = null;

        for (const proj of projects) {
          try {
            const data = exportProjectData(proj.dbPath, { since, dnaFull });
            // Tag each node with project name
            for (const node of data.nodes) {
              if (!node.dna) node.dna = {};
              node.dna._project = proj.name;
              mergedNodes.push(node);
            }
            // Prefix station IDs to avoid collision (bootstrap only)
            if (data.stations) {
              for (const s of data.stations) {
                s.id = `${proj.name}:${s.id}`;
                s.name = `${s.name} (${proj.name})`;
                mergedStations.push(s);
              }
            }
            totalQueue += data.queue_count;
            totalActive += data.active_count;
            totalCompleted += data.completed_count;
            if (data.change_seq && (!maxChangeSeq || data.change_seq > maxChangeSeq)) {
              maxChangeSeq = data.change_seq;
            }
          } catch (err) {
            console.error(`Skipping project ${proj.name}:`, err.message);
          }
        }

        const responseData = {
          exported_at: new Date().toISOString(),
          project: 'All Projects',
          change_seq: maxChangeSeq,
          queue_count: totalQueue,
          active_count: totalActive,
          completed_count: totalCompleted,
          nodes: mergedNodes
        };
        if (since) {
          responseData.since = since;
          responseData.changed_count = mergedNodes.length;
          responseData.deleted_slugs = [];
        } else {
          responseData.node_count = mergedNodes.length;
          responseData.stations = mergedStations;
        }
        const responseBody = JSON.stringify(responseData);
        const etag = '"' + crypto.createHash('md5').update(responseBody).digest('hex') + '"';
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          res.writeHead(304, { 'ETag': etag, 'Access-Control-Allow-Origin': '*' });
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'ETag': etag,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(responseBody);
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
      const data = exportProjectData(targetProject.dbPath, { since, dnaFull });
      data.project = targetProject.name;
      const responseBody = JSON.stringify(data);
      const etag = '"' + crypto.createHash('md5').update(responseBody).digest('hex') + '"';
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        res.writeHead(304, { 'ETag': etag, 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(responseBody);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
    return;
  }

  // API: Get current viz version from active symlink
  if (pathname === '/api/version' && req.method === 'GET') {
    try {
      const activePath = path.join(__dirname, 'active');
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
      const dirs = fs.readdirSync(versionsDir).filter(d => d.startsWith('v')).sort((a, b) => {
        const pa = a.replace('v', '').split('.').map(Number);
        const pb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) { if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0); }
        return 0;
      });
      for (const dir of dirs) {
        const changelogPath = path.join(versionsDir, dir, 'changelog.json');
        if (fs.existsSync(changelogPath)) {
          changelogs.push(JSON.parse(fs.readFileSync(changelogPath, 'utf-8')));
        }
      }
    } catch (e) { /* ignore */ }
    sendJson(res, { changelogs: changelogs.slice(0, 33) });
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

  // Static files — serve from active/ symlink directory
  const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
    ? path.resolve(path.join(__dirname, 'active'))
    : __dirname;
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(staticRoot, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStatic(res, filePath);
});

const BIND_HOST = process.env.VIZ_BIND || '0.0.0.0';
server.listen(PORT, BIND_HOST, () => {
  console.log(`Viz server running at http://${BIND_HOST}:${PORT}`);
  console.log(`Workspace: ${WORKSPACE_PATH}`);
  const projects = discoverProjects();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);
});
