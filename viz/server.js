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
const jwt = require('jsonwebtoken');

const PORT = parseInt(process.argv[2]) || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const API_PORT = parseInt(process.env.API_PORT || '3100', 10);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Paths that bypass auth — login page, registration, static assets, health, auth API
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/invite/',
  '/health',
  '/api/auth/',
  '/assets/',
  '/favicon.ico',
];

/**
 * Parse cookies from request header
 */
function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...rest] = pair.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  });
  return cookies;
}

/**
 * Check if a path is public (no auth required)
 */
function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p));
}

/**
 * Verify JWT from ms_session cookie. Returns decoded payload or null.
 */
function verifySession(req) {
  if (!JWT_SECRET) return null;
  const cookies = parseCookies(req);
  const token = cookies.ms_session;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Get CORS origin header value — returns the request origin if allowed, or empty
 */
function getCorsOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return '';
  if (ALLOWED_ORIGINS.length === 0) return origin; // No config = allow same-origin only (no header)
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return '';
}

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
 * Knowledge Browser: resolve hierarchy nodes by short_id
 * Routes: /m/:id (mission), /c/:id (capability), /r/:id (requirement), /t/:id (task)
 */
const KB_TYPE_MAP = {
  m: { table: 'missions', label: 'Mission',
    query: "SELECT m.*, m.short_id FROM missions m WHERE m.short_id = ?" },
  c: { table: 'capabilities', label: 'Capability',
    query: "SELECT c.*, c.short_id, m.title as mission_title, m.short_id as mission_short_id FROM capabilities c JOIN missions m ON c.mission_id = m.id WHERE c.short_id = ?" },
  r: { table: 'requirements', label: 'Requirement',
    query: "SELECT r.*, r.short_id, c.title as capability_title, c.short_id as capability_short_id, m.title as mission_title, m.short_id as mission_short_id FROM requirements r JOIN capabilities c ON r.capability_id = c.id JOIN missions m ON c.mission_id = m.id WHERE r.short_id = ?" },
  t: { table: 'mindscape_nodes', label: 'Task', query: null },
};

function handleKbRoute(res, typePrefix, shortId, suffix) {
  const typeInfo = KB_TYPE_MAP[typePrefix];
  if (!typeInfo || !typeInfo.query) {
    send404(res, shortId, typePrefix);
    return;
  }

  const projects = discoverProjects();
  const currentProject = path.basename(__dirname.replace('/viz', ''));
  const targetProjects = projects.filter(p => p.name === currentProject);

  for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
    try {
      const db = new Database(proj.dbPath, { readonly: true });
      try {
        const node = db.prepare(typeInfo.query).get(shortId);
        if (node) {
          db.close();
          if (suffix === '.md') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(node.content_md || node.description || '');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderNodePage(node, typePrefix, typeInfo));
          return;
        }
      } catch (err) { /* table may not exist */ }
      db.close();
    } catch (err) { /* skip project */ }
  }
  send404(res, shortId, typePrefix);
}

function renderNodePage(node, typePrefix, typeInfo) {
  const title = node.title || node.req_id_human || 'Untitled';
  const description = node.description || '';
  const breadcrumb = [];
  breadcrumb.push('<a href="/" style="color:#8ab4f8;text-decoration:none;">Mindspace</a>');
  if (node.mission_title && node.mission_short_id) {
    breadcrumb.push(`<a href="/m/${node.mission_short_id}" style="color:#8ab4f8;text-decoration:none;">${node.mission_title}</a>`);
  }
  if (node.capability_title && node.capability_short_id) {
    breadcrumb.push(`<a href="/c/${node.capability_short_id}" style="color:#8ab4f8;text-decoration:none;">${node.capability_title}</a>`);
  }
  breadcrumb.push(`<span style="color:#eee;">${title}</span>`);

  const content = node.content_md || description;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Mindspace</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description.slice(0, 200)}">
<meta property="og:type" content="article">
<style>body{margin:0;padding:0;background:#0f1117;color:#eee;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}
.container{max-width:720px;margin:0 auto;padding:24px 16px;}
.breadcrumb{font-size:13px;color:#888;margin-bottom:16px;}
.breadcrumb a:hover{text-decoration:underline;}
.breadcrumb span:not(:last-child)::after{content:" › ";color:#555;}
h1{font-size:24px;margin:0 0 8px;color:#eee;}
.type-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;}
.content{line-height:1.6;color:#ccc;margin-top:16px;white-space:pre-wrap;}</style>
</head><body>
<div class="container">
<div class="breadcrumb">${breadcrumb.join('')}</div>
<div class="type-label">${typeInfo.label}</div>
<h1>${title}</h1>
<div class="content">${content}</div>
</div></body></html>`;
}

function send404(res, shortId, typePrefix) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html><html><head><title>Not Found — Mindspace</title>
<style>body{margin:0;padding:40px;background:#0f1117;color:#eee;font-family:sans-serif;text-align:center;}
a{color:#8ab4f8;}</style></head><body>
<h1>404 — Not Found</h1>
<p>No ${typePrefix === 'm' ? 'mission' : typePrefix === 'c' ? 'capability' : typePrefix === 'r' ? 'requirement' : 'node'} found with ID <code>${shortId}</code></p>
<p><a href="/">Back to Mindspace</a></p>
</body></html>`);
}

/**
 * Send JSON response
 */
function sendJson(res, data, status = 200, req = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (req) {
    const corsOrigin = getCorsOrigin(req);
    if (corsOrigin) headers['Access-Control-Allow-Origin'] = corsOrigin;
  }
  res.writeHead(status, headers);
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

  // ─── D6: Logout — clear ms_session cookie ───
  if (pathname === '/logout' || pathname === '/api/auth/logout') {
    res.writeHead(302, {
      'Set-Cookie': 'ms_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
      'Location': '/login'
    });
    res.end();
    return;
  }

  // ─── D7: Proxy auth requests to API server ───
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const apiRes = await fetch(`http://localhost:${API_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await apiRes.json();
      if (apiRes.ok && data.token) {
        // D2: Set JWT as httpOnly cookie with SameSite=Strict
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `ms_session=${data.token}; HttpOnly; SameSite=Strict; Path=/`
        });
        res.end(JSON.stringify(data));
      } else {
        res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      }
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API server unreachable' }));
    }
    return;
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const apiRes = await fetch(`http://localhost:${API_PORT}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await apiRes.json();
      res.writeHead(apiRes.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API server unreachable' }));
    }
    return;
  }

  // ─── Invite landing: /invite/{code} → register page with code pre-filled ───
  const inviteMatch = pathname.match(/^\/invite\/([^/]+)$/);
  if (inviteMatch) {
    const code = inviteMatch[1];
    res.writeHead(302, { 'Location': `/register?code=${encodeURIComponent(code)}` });
    res.end();
    return;
  }

  // ─── D1/D3: Auth gate — check ms_session cookie ───
  if (!isPublicPath(pathname)) {
    const session = verifySession(req);
    if (!session) {
      // D3: Return 401 for API requests
      if (pathname.startsWith('/api/')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }
      // D1: Redirect browser requests to /login
      res.writeHead(302, { 'Location': '/login' });
      res.end();
      return;
    }
  }

  // API: List projects
  if (pathname === '/api/projects') {
    // Proxy to Mindspace API for authenticated project list
    try {
      const cookies = parseCookies(req);
      const apiRes = await fetch(`http://localhost:${API_PORT}/api/projects`, {
        headers: cookies.ms_session ? { 'Authorization': `Bearer ${cookies.ms_session}` } : {}
      });
      if (apiRes.ok) {
        const apiProjects = await apiRes.json();
        sendJson(res, { current: null, projects: apiProjects.map(p => ({ name: p.name, slug: p.slug, path: p.slug })) }, 200, req);
        return;
      }
    } catch (e) { /* API unavailable, fall through to filesystem */ }
    // Fallback to filesystem discovery (unauthenticated or API down)
    const projects = discoverProjects();
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    sendJson(res, {
      current: currentProject,
      projects: projects.map(p => ({ name: p.name, path: p.path }))
    });
    return;
  }

  // API: Mission overview (missions with nested capabilities, requirement-based task counting)
  if (pathname === '/api/mission-overview') {
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();
    // Project deduplication: prefer project matching viz working directory
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    const targetProjects = projectName === 'all' ? projects :
      projectName ? projects.filter(p => p.name === projectName) :
      projects.filter(p => p.name === currentProject);

    const missions = [];
    for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const missionRows = db.prepare("SELECT id, slug, title, description, status FROM missions WHERE status = 'active' ORDER BY created_at ASC").all();
          for (const m of missionRows) {
            const caps = db.prepare("SELECT id, title, description, status, sort_order FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC").all(m.id);
            const enrichedCaps = caps.map(cap => {
              // Get requirements for this capability
              let reqs = [];
              try {
                reqs = db.prepare("SELECT req_id_human, title FROM requirements WHERE capability_id = ?").all(cap.id);
              } catch (e) { /* requirements table may not exist */ }
              // Count tasks via requirement_refs LIKE matching in dna_json
              let task_count = 0;
              let complete_count = 0;
              for (const r of reqs) {
                try {
                  task_count += db.prepare("SELECT COUNT(*) as c FROM mindspace_nodes WHERE type='task' AND dna_json LIKE '%' || ? || '%'").get(r.req_id_human).c;
                  complete_count += db.prepare("SELECT COUNT(*) as c FROM mindspace_nodes WHERE type='task' AND status='complete' AND dna_json LIKE '%' || ? || '%'").get(r.req_id_human).c;
                } catch (e) { /* mindspace_nodes may not exist */ }
              }
              const progress_percent = task_count > 0 ? Math.round((complete_count / task_count) * 100) : 0;
              return { id: cap.id, title: cap.title, description: cap.description, status: cap.status, task_count, complete_count, progress_percent, requirements: reqs };
            });
            missions.push({ id: m.id, slug: m.slug, title: m.title, description: m.description, status: m.status, capabilities: enrichedCaps });
          }
        } catch (err) { /* tables may not exist */ }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, { missions });
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
            // Requirements linked via capability_id column
            let requirements = [];
            try {
              requirements = db.prepare(
                `SELECT id, req_id_human, title, status, priority, description
                 FROM requirements WHERE capability_id = ?
                 ORDER BY req_id_human ASC`
              ).all(capId);
            } catch (reqErr) { requirements = []; }

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

            // Get mission context for breadcrumb navigation
            const mission = db.prepare('SELECT id, title FROM missions WHERE id = ?')
              .get(cap.mission_id);

            db.close();
            sendJson(res, {
              id: cap.id,
              title: cap.title,
              description: cap.description,
              status: cap.status,
              mission_id: cap.mission_id,
              mission_title: mission ? mission.title : null,
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

  // API: Capability requirements with implementing tasks — GET /api/capabilities/:capId/requirements
  if (pathname.match(/^\/api\/capabilities\/([^/]+)\/requirements$/)) {
    const capId = pathname.split('/')[3];
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    const targetProjects = projectName ? projects.filter(p => p.name === projectName) :
      projects.filter(p => p.name === currentProject);

    for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const reqs = db.prepare("SELECT id, req_id_human, title, description, status, priority FROM requirements WHERE capability_id = ? ORDER BY req_id_human").all(capId);
          const enrichedReqs = reqs.map(r => {
            let tasks = [];
            try {
              const taskRows = db.prepare("SELECT slug, dna_json, status FROM mindspace_nodes WHERE type='task' AND dna_json LIKE '%' || ? || '%'").all(r.req_id_human);
              tasks = taskRows.map(t => {
                const dna = t.dna_json ? JSON.parse(t.dna_json) : {};
                return { slug: t.slug, title: dna.title || t.slug, status: t.status };
              });
            } catch (e) { /* mindscape_nodes may not exist */ }
            return { ...r, tasks, task_count: tasks.length, complete_count: tasks.filter(t => t.status === 'complete').length };
          });
          db.close();
          sendJson(res, { capability_id: capId, requirements: enrichedReqs });
          return;
        } catch (err) { /* tables may not exist */ }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, { error: 'Capability not found' }, 404);
    return;
  }

  // API: Task detail with breadcrumb hierarchy — GET /api/tasks/:slug
  if (pathname.match(/^\/api\/tasks\/([^/]+)$/)) {
    const slug = pathname.split('/')[3];
    const projectName = url.searchParams.get('project');
    const projects = discoverProjects();
    const targetProjects = projectName ? projects.filter(p => p.name === projectName) : projects;

    for (const proj of (targetProjects.length ? targetProjects : projects)) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        try {
          const node = db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?').get(slug);
          if (node) {
            const dna = node.dna_json ? JSON.parse(node.dna_json) : {};

            // Find parent capability and mission via capability_tasks join
            let parentCapability = null;
            let parentMission = null;
            try {
              const capLink = db.prepare(
                `SELECT ct.capability_id, c.title, c.mission_id, m.title AS mission_title
                 FROM capability_tasks ct
                 JOIN capabilities c ON c.id = ct.capability_id
                 JOIN missions m ON m.id = c.mission_id
                 WHERE ct.task_slug = ?`
              ).get(slug);
              if (capLink) {
                parentCapability = { id: capLink.capability_id, title: capLink.title };
                parentMission = { id: capLink.mission_id, title: capLink.mission_title };
              }
            } catch (e) { /* join tables may not exist */ }

            db.close();
            sendJson(res, {
              slug: node.slug,
              title: dna.title || node.slug,
              status: node.status,
              role: dna.role || null,
              description: dna.description || null,
              depends_on: dna.depends_on || [],
              pdsa_ref: dna.pdsa_ref || null,
              requirement_refs: dna.requirement_refs || [],
              group: dna.group || null,
              breadcrumb: [
                parentMission ? { level: 'mission', id: parentMission.id, title: parentMission.title } : null,
                parentCapability ? { level: 'capability', id: parentCapability.id, title: parentCapability.title } : null,
                { level: 'task', id: node.slug, title: dna.title || node.slug }
              ].filter(Boolean),
              parent_capability: parentCapability,
              parent_mission: parentMission
            });
            return;
          }
        } catch (err) { /* tables may not exist */ }
        db.close();
      } catch (err) { /* skip project */ }
    }
    sendJson(res, { error: 'Task not found' }, 404);
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
        const corsOrigin = getCorsOrigin(req);
        const corsHeaders = corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {};
        if (ifNoneMatch === etag) {
          res.writeHead(304, { 'ETag': etag, ...corsHeaders });
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'ETag': etag,
          ...corsHeaders,
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
      const corsOrigin2 = getCorsOrigin(req);
      const corsHeaders2 = corsOrigin2 ? { 'Access-Control-Allow-Origin': corsOrigin2 } : {};
      if (ifNoneMatch === etag) {
        res.writeHead(304, { 'ETag': etag, ...corsHeaders2 });
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'ETag': etag,
        ...corsHeaders2,
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

  // Catch-all API proxy: any /api/* or /a2a/* not handled above → forward to API server
  if (pathname.startsWith('/api/') || pathname.startsWith('/a2a/') || pathname === '/.well-known/agent.json') {
    try {
      const cookies = parseCookies(req);
      const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
      if (cookies.ms_session) headers['Authorization'] = `Bearer ${cookies.ms_session}`;

      const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : undefined;
      const apiRes = await fetch(`http://localhost:${API_PORT}${pathname}${url.search}`, {
        method: req.method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });

      // Forward all response headers (including Set-Cookie for OAuth)
      const resHeaders = {};
      apiRes.headers.forEach((value, key) => { resHeaders[key] = value; });

      // For redirects (OAuth flow), forward the redirect
      if (apiRes.status >= 300 && apiRes.status < 400) {
        res.writeHead(apiRes.status, { 'Location': apiRes.headers.get('location'), ...resHeaders });
        res.end();
        return;
      }

      const data = await apiRes.text();
      res.writeHead(apiRes.status, resHeaders);
      res.end(data);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API server unreachable' }));
    }
    return;
  }

  // Knowledge Browser routes: /m/:id/:slug?, /c/:id/:slug?, /r/:id/:slug?, /t/:id/:slug?
  const KB_ROUTE = /^\/(m|c|r|t)\/([a-zA-Z0-9]{1,12})(\/[^.]*)?(\.\w+)?$/;
  const kbMatch = pathname.match(KB_ROUTE);
  if (kbMatch) {
    handleKbRoute(res, kbMatch[1], kbMatch[2], kbMatch[4]);
    return;
  }

  // Static files — serve from active/ symlink directory, fallback to root for shared assets
  const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
    ? path.resolve(path.join(__dirname, 'active'))
    : __dirname;
  let filePath = pathname === '/' ? '/index.html' : pathname;
  let resolvedPath = path.join(staticRoot, filePath);

  // Try .html extension for extensionless paths (e.g., /login → login.html)
  if (!fs.existsSync(resolvedPath) && !path.extname(filePath)) {
    const htmlPath = path.join(staticRoot, filePath + '.html');
    if (fs.existsSync(htmlPath)) {
      resolvedPath = htmlPath;
    }
  }

  // Fallback to root dir for shared assets (e.g., /assets/favicons/)
  if (!fs.existsSync(resolvedPath) && staticRoot !== __dirname) {
    resolvedPath = path.join(__dirname, filePath);
  }

  // Security: prevent directory traversal
  if (!resolvedPath.startsWith(staticRoot) && !resolvedPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveStatic(res, resolvedPath);
});

const BIND_HOST = process.env.VIZ_BIND || '0.0.0.0';
server.listen(PORT, BIND_HOST, () => {
  console.log(`Viz server running at http://${BIND_HOST}:${PORT}`);
  console.log(`Workspace: ${__dirname}`);
  const projects = discoverProjects();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);
});
