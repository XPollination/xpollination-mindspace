#!/usr/bin/env node
/**
 * Visualization server with multi-project support
 * Usage: node viz/server.js [port]
 *
 * All data access is via API fetch — no direct SQLite usage.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Projects discovered via API instead of filesystem scanner
async function discoverProjectsViaApi() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    if (res.ok) return await res.json();
  } catch { /* API not available */ }
  return [];
}

const PORT = parseInt(process.argv[2]) || 3000;
const API_PORT = process.env.API_PORT || '3100';
const API_BASE = `http://localhost:${API_PORT}`;

/**
 * Fetch JSON from the backend API
 */
async function apiFetch(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok && res.status !== 404) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetch with POST/PUT body
 */
async function apiFetchWithBody(path, method, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// Default status filter: exclude blocked and cancelled from default view
// Client-side filtering in index.html uses these as the initial active pipeline
const DEFAULT_VISIBLE_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework'];

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
const LITE_FIELDS = ['title', 'role', 'description', 'depends_on', 'group', 'environment', 'priority', '_project', 'pdsa_ref', 'abstract_ref', 'changelog_ref'];
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
 * Fetch project data from the API
 */
async function fetchProjectData(projectName, options) {
  const { since, dnaFull } = options || {};
  const params = new URLSearchParams();
  if (projectName) params.set('project', projectName);
  if (since) params.set('since', since);
  if (dnaFull) params.set('dna', 'full');
  const data = await apiFetch(`/api/data?${params.toString()}`);
  return data;
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API: List projects
  if (pathname === '/api/projects') {
    const projects = await discoverProjectsViaApi();
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    sendJson(res, {
      current: currentProject,
      projects: projects.map(p => ({ name: p.name, path: p.path }))
    });
    return;
  }

  // API: Mission overview (capabilities with progress)
  if (pathname === '/api/mission-overview') {
    try {
      const projectName = url.searchParams.get('project');
      const params = projectName ? `?project=${encodeURIComponent(projectName)}` : '';
      const data = await apiFetch(`/api/mission-overview${params}`);
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { capabilities: [] });
    }
    return;
  }

  // API: Capability detail — GET /api/capabilities/:capId
  if (pathname.match(/^\/api\/capabilities\/([^/]+)$/)) {
    try {
      const capId = pathname.split('/')[3];
      const projectName = url.searchParams.get('project');
      const params = projectName ? `?project=${encodeURIComponent(projectName)}` : '';
      const data = await apiFetch(`/api/capabilities/${encodeURIComponent(capId)}${params}`);
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { error: 'Capability not found' }, 404);
    }
    return;
  }

  // API: Task detail with breadcrumb hierarchy — GET /api/tasks/:slug
  if (pathname.match(/^\/api\/tasks\/([^/]+)$/)) {
    try {
      const slug = pathname.split('/')[3];
      const projectName = url.searchParams.get('project');
      const params = projectName ? `?project=${encodeURIComponent(projectName)}` : '';
      const data = await apiFetch(`/api/tasks/${encodeURIComponent(slug)}${params}`);
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { error: 'Task not found' }, 404);
    }
    return;
  }

  // API: Suspect links stats
  if (pathname === '/api/suspect-links/stats') {
    try {
      const projectName = url.searchParams.get('project');
      const params = projectName ? `?project=${encodeURIComponent(projectName)}` : '';
      const data = await apiFetch(`/api/suspect-links/stats${params}`);
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { suspect: 0, cleared: 0, accepted_risk: 0, total: 0, by_source_type: {} });
    }
    return;
  }

  // API: Get project data
  if (pathname === '/api/data') {
    const projectName = url.searchParams.get('project');
    const since = url.searchParams.get('since');
    const dnaMode = url.searchParams.get('dna');
    const dnaFull = dnaMode === 'full';
    const projects = await discoverProjectsViaApi();

    // All Projects: merge data from all discovered project APIs
    if (projectName === 'all') {
      try {
        const mergedNodes = [];
        const mergedStations = [];
        let totalQueue = 0, totalActive = 0, totalCompleted = 0;
        let maxChangeSeq = null;

        for (const proj of projects) {
          try {
            const data = await fetchProjectData(proj.name, { since, dnaFull });
            // Tag each node with project name
            for (const node of (data.nodes || [])) {
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
            totalQueue += data.queue_count || 0;
            totalActive += data.active_count || 0;
            totalCompleted += data.completed_count || 0;
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
      const data = await fetchProjectData(targetProject.name, { since, dnaFull });
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

  // API: Get LIAISON approval mode — proxy to backend API
  if (pathname === '/api/settings/liaison-approval-mode' && req.method === 'GET') {
    try {
      const data = await apiFetch('/api/settings/liaison-approval-mode');
      sendJson(res, data);
    } catch (err) {
      sendJson(res, { mode: 'manual', updated_by: 'system', updated_at: null });
    }
    return;
  }

  // API: Set LIAISON approval mode — proxy to backend API
  if (pathname === '/api/settings/liaison-approval-mode' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      if (!body.mode || !['manual', 'semi', 'auto-approval', 'auto'].includes(body.mode)) {
        sendJson(res, { error: 'Invalid mode. Must be "manual", "semi", "auto-approval", or "auto".' }, 400);
        return;
      }
      const data = await apiFetchWithBody('/api/settings/liaison-approval-mode', 'PUT', body);
      sendJson(res, data);
    } catch (e) {
      sendJson(res, { error: e.message }, 400);
    }
    return;
  }

  // API: Confirm task (set human_confirmed in DNA) — proxy to backend API
  const confirmMatch = pathname.match(/^\/api\/node\/([^/]+)\/confirm$/);
  if (confirmMatch && req.method === 'PUT') {
    try {
      const slug = confirmMatch[1];
      const body = await readBody(req);
      const data = await apiFetchWithBody(`/api/node/${encodeURIComponent(slug)}/confirm`, 'PUT', body);
      sendJson(res, data);
    } catch (e) {
      sendJson(res, { error: e.message }, 400);
    }
    return;
  }

  // API: Rework task — PUT /api/node/:slug/rework — proxy to backend API
  const reworkMatch = pathname.match(/^\/api\/node\/([^/]+)\/rework$/);
  if (reworkMatch && req.method === 'PUT') {
    try {
      const slug = reworkMatch[1];
      const body = await readBody(req);
      const data = await apiFetchWithBody(`/api/node/${encodeURIComponent(slug)}/rework`, 'PUT', body);
      sendJson(res, data);
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
  console.log(`API backend: ${API_BASE}`);
  const projects = await discoverProjectsViaApi();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);
});
