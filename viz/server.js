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
  '/api/health',
  '/assets/',
  '/docs/',
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
    // backlog tasks excluded from main kanban view — they are pre-queue, not yet prioritized
    const backlogCount = allNodes.filter(n => n.status === 'backlog').length;
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
 * Knowledge Browser: render hierarchy nodes as styled pages
 * Routes: /m/:id (mission), /c/:id (capability), /r/:id (requirement), /t/:id (task)
 */
let marked;
try { marked = require('marked'); } catch { marked = null; }

const KB_TYPE_MAP = {
  m: { table: 'missions', label: 'Mission', color: '#22c55e',
    query: "SELECT m.*, m.short_id FROM missions m WHERE m.short_id = ?" },
  c: { table: 'capabilities', label: 'Capability', color: '#8ab4f8',
    query: "SELECT c.*, c.short_id, m.title as mission_title, m.short_id as mission_short_id FROM capabilities c JOIN missions m ON c.mission_id = m.id WHERE c.short_id = ?" },
  r: { table: 'requirements', label: 'Requirement', color: '#eab308',
    query: "SELECT r.*, r.short_id, c.title as capability_title, c.short_id as capability_short_id, m.title as mission_title, m.short_id as mission_short_id FROM requirements r JOIN capabilities c ON r.capability_id = c.id JOIN missions m ON c.mission_id = m.id WHERE r.short_id = ?" },
  t: { table: 'mindspace_nodes', label: 'Task', color: '#ef4444', query: null },
};

const KB_ROUTE = /^\/(m|c|r|t)\/([a-zA-Z0-9]{1,12})(\/[^.]*)?(\.\w+)?$/;

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildBreadcrumb(node, typePrefix) {
  const crumbs = [];
  crumbs.push({ label: 'Mindspace', href: '/' });
  if (node.mission_title && node.mission_short_id) {
    crumbs.push({ label: node.mission_title, href: `/m/${node.mission_short_id}/${slugify(node.mission_title)}` });
  }
  if (node.capability_title && node.capability_short_id) {
    crumbs.push({ label: node.capability_title, href: `/c/${node.capability_short_id}/${slugify(node.capability_title)}` });
  }
  const title = node.title || node.req_id_human || 'Untitled';
  crumbs.push({ label: title, href: null });
  return crumbs;
}

function getSiblings(db, node, typePrefix) {
  try {
    if (typePrefix === 'c' && node.mission_id) {
      return db.prepare("SELECT id, title, short_id, status FROM capabilities WHERE mission_id = ? AND id != ? ORDER BY sort_order ASC").all(node.mission_id, node.id);
    }
    if (typePrefix === 'r' && node.capability_id) {
      return db.prepare("SELECT id, req_id_human, title, short_id, status FROM requirements WHERE capability_id = ? AND id != ? ORDER BY req_id_human ASC").all(node.capability_id, node.id);
    }
  } catch (e) { /* table may not exist */ }
  return [];
}

function handleKbRoute(res, typePrefix, shortId, suffix, db) {
  const typeInfo = KB_TYPE_MAP[typePrefix];
  if (!typeInfo || !typeInfo.query) {
    send404(res, shortId, typePrefix);
    return;
  }

  try {
    const node = db.prepare(typeInfo.query).get(shortId);
    if (node) {
      if (suffix === '.md') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(node.content_md || node.description || '');
        return;
      }
      // Fetch children for drill-down
      let children = [];
      if (typePrefix === 'm') {
        children = db.prepare("SELECT id, title, description, short_id, status FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC").all(node.id);
      } else if (typePrefix === 'c') {
        children = db.prepare("SELECT id, req_id_human, title, description, short_id, status FROM requirements WHERE capability_id = ? ORDER BY req_id_human ASC").all(node.id);
      }
      const siblings = getSiblings(db, node, typePrefix);
      // Version timeline for capabilities
      let versionHistory = [];
      if (typePrefix === 'c') {
        try {
          versionHistory = db.prepare("SELECT * FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC").all(node.id);
        } catch (e) { /* table may not exist */ }
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderNodePage(node, typePrefix, typeInfo, children, siblings, versionHistory));
      return;
    }
  } catch (err) { /* table may not exist */ }
  send404(res, shortId, typePrefix);
}

function renderNodePage(node, typePrefix, typeInfo, children, siblings, versionHistory) {
  const title = node.title || node.req_id_human || 'Untitled';
  const description = node.description || '';
  const content = node.content_md || description;

  // Render markdown with marked.parse if available, fallback to pre-formatted
  let renderedContent;
  if (marked && marked.parse) {
    // Rewrite diagram image paths: docs/diagrams/... → /docs/diagrams/...
    const rewritten = content.replace(/\!\[([^\]]*)\]\(docs\//g, '![$1](/docs/');
    renderedContent = marked.parse(rewritten);
  } else {
    renderedContent = '<div style="white-space:pre-wrap;">' + content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>';
  }

  // Build breadcrumb with short_id links
  const crumbs = buildBreadcrumb(node, typePrefix);
  const breadcrumb = crumbs.map(c =>
    c.href ? `<a href="${c.href}">${c.label}</a>` : `<span class="current">${c.label}</span>`
  );

  // Children cards
  const childPrefix = typePrefix === 'm' ? 'c' : typePrefix === 'c' ? 'r' : 't';
  const childLabel = typePrefix === 'm' ? 'Capabilities' : typePrefix === 'c' ? 'Requirements' : 'Tasks';
  const childrenHtml = children.length > 0 ? `
    <section class="children">
      <h2>${childLabel}</h2>
      <div class="child-grid">
        ${children.map(c => `
          <a href="/${childPrefix}/${c.short_id || c.id}" class="child-card">
            <h3>${c.title || c.req_id_human || c.id}</h3>
            <p>${(c.description || '').slice(0, 100)}${(c.description || '').length > 100 ? '...' : ''}</p>
          </a>
        `).join('')}
      </div>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Mindspace</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description.slice(0, 200)}">
<meta property="og:type" content="article">
<style>
:root{--bg:#ffffff;--surface:#f5f5f5;--border:#e0e0e0;--text:#1a1a2e;--muted:#666;--link:#1a56db;--content-color:#333;}
[data-theme="dark"]{--bg:#0f1117;--surface:#1a1a2e;--border:#333;--text:#eee;--muted:#888;--link:#8ab4f8;--content-color:#ccc;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;}
.theme-toggle{position:fixed;top:12px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:14px;color:var(--text);z-index:100;}
.container{max-width:760px;margin:0 auto;padding:24px 16px;}
.breadcrumb{font-size:13px;color:var(--muted);margin-bottom:20px;}
.breadcrumb a{color:var(--muted);text-decoration:none;}
.breadcrumb a:hover{text-decoration:underline;color:var(--link);}
.breadcrumb .current{color:var(--link);}
.breadcrumb span:not(:last-child)::after,.breadcrumb a::after{content:" › ";color:#555;}
.badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#fff;background:${typeInfo.color};margin-bottom:8px;}
h1{font-size:26px;margin:0 0 16px;color:var(--text);}
.content{line-height:1.7;color:var(--content-color);}
.content h2{color:var(--text);margin:24px 0 12px;font-size:20px;border-bottom:1px solid var(--border);padding-bottom:4px;}
.content h3{color:var(--text);margin:16px 0 8px;font-size:16px;}
.content p{margin:8px 0;}
.content code{background:var(--surface);padding:2px 6px;border-radius:3px;font-size:13px;}
.content pre{background:var(--surface);padding:12px;border-radius:6px;overflow-x:auto;margin:12px 0;}
.content pre code{background:none;padding:0;}
.content table{width:100%;border-collapse:collapse;margin:12px 0;}
.content th,.content td{border:1px solid var(--border);padding:8px;text-align:left;}
.content th{background:var(--surface);}
.content img{max-width:100%;height:auto;margin:16px 0;border-radius:6px;border:1px solid var(--border);}
.content a{color:var(--link);text-decoration:none;}
.content a:hover{text-decoration:underline;}
.content ul,.content ol{margin:8px 0 8px 24px;}
.content li{margin:4px 0;}
.content blockquote{border-left:3px solid var(--border);padding-left:12px;color:var(--muted);margin:12px 0;}
.content strong{color:var(--text);}
.content hr{border:none;border-top:1px solid var(--border);margin:24px 0;}
.children{margin-top:32px;}
.children h2{color:var(--text);font-size:18px;margin-bottom:12px;}
.child-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;}
.child-card{display:block;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--text);transition:border-color 0.2s;}
.child-card:hover{border-color:var(--link);}
.child-card h3{font-size:14px;margin-bottom:4px;color:var(--link);}
.child-card p{font-size:12px;color:var(--muted);margin:0;}
.metadata{margin-top:24px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);}
@media(max-width:768px){.child-grid,.mission-grid{grid-template-columns:repeat(2,1fr);} .hamburger{display:block;} nav.breadcrumb{overflow-x:auto;white-space:nowrap;}}
@media(max-width:480px){.container{padding:16px 12px;} .child-grid,.mission-grid{grid-template-columns:1fr;} .content table{display:block;overflow-x:auto;}}
.child-card,.mission-card,a.nav-link{min-height:44px;}
.hamburger{display:none;cursor:pointer;font-size:24px;background:none;border:none;color:var(--text);}
</style>
</head><body>
<button class="theme-toggle" onclick="toggleTheme()" title="Toggle dark mode">🌓</button>
<script>
// Theme toggle with localStorage persistence
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}
// Apply saved preference (default: light)
const saved = localStorage.getItem('theme');
if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
</script>
<div class="container">
<nav class="breadcrumb">${breadcrumb.join('')}</nav>
<div class="badge">${typeInfo.label}</div>
<h1>${title}</h1>
<div class="content">${renderedContent}</div>
${childrenHtml}
${(siblings || []).length > 0 ? `
<section class="siblings" style="margin-top:24px;">
  <h3 style="font-size:14px;color:var(--muted);margin-bottom:8px;">Also under ${node.mission_title || 'this parent'}</h3>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">
    ${siblings.map(s => {
      const prefix = typePrefix;
      const sTitle = s.title || s.req_id_human || s.id;
      return `<a href="/${prefix}/${s.short_id || s.id}/${slugify(sTitle)}" style="padding:4px 10px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-size:12px;color:var(--link);text-decoration:none;">${sTitle}</a>`;
    }).join('')}
  </div>
</section>` : ''}
${(versionHistory || []).length > 0 ? `
<section class="version-timeline" style="margin-top:24px;">
  <h2 style="font-size:16px;color:var(--text);margin-bottom:12px;">Version History</h2>
  ${versionHistory.slice(0, 3).map((v, i) => `
    <div style="padding:8px 12px;border-left:3px solid ${i === 0 ? '#22c55e' : '#444'};margin-bottom:8px;background:var(--surface);border-radius:0 4px 4px 0;">
      <strong style="color:var(--text);">v${v.version}</strong> <span style="color:var(--muted);font-size:11px;">${v.changed_at || ''} by ${v.changed_by}</span>
      ${v.changelog ? `<p style="margin:4px 0 0;font-size:12px;color:var(--muted);">${v.changelog}</p>` : ''}
    </div>
  `).join('')}
  ${versionHistory.length > 3 ? `
    <details style="margin-top:4px;">
      <summary style="cursor:pointer;color:var(--link);font-size:12px;">Show ${versionHistory.length - 3} more versions</summary>
      ${versionHistory.slice(3).map(v => `
        <div style="padding:6px 12px;border-left:3px solid #333;margin-top:4px;font-size:12px;color:var(--muted);">
          <strong>v${v.version}</strong> — ${v.changelog || 'No changelog'}
        </div>
      `).join('')}
    </details>
  ` : ''}
</section>` : ''}
<div class="metadata">
  Version ${node.content_version || 0}
  <span style="margin-left:16px;"><a href="/" style="color:var(--link);">View Tasks</a> · <a href="/" style="color:var(--link);">Back to Dashboard</a></span>
</div>
</div></body></html>`;
}

/**
 * renderSearchBar — Vector search with brain API, debounce, dropdown overlay
 * Part 18/Part 6 of Structured Knowledge Objects
 */
function renderSearchBar() {
  return `<div style="position:relative;margin-bottom:16px;">
    <input type="text" placeholder="Search knowledge..." oninput="debounceSearch(this.value)" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:14px;">
    <div class="search-overlay" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg);border:1px solid var(--border);border-radius:0 0 4px 4px;max-height:300px;overflow-y:auto;z-index:50;"></div>
  </div>
  <script>
  let _st;function debounceSearch(q){clearTimeout(_st);_st=setTimeout(()=>vectorSearch(q),300);}
  async function vectorSearch(q){if(!q||q.length<2){document.querySelector('.search-overlay').style.display='none';return;}
    try{const r=await fetch('/api/v1/memory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:q,read_only:true})});
    const d=await r.json();const o=document.querySelector('.search-overlay');
    if(d.result&&d.result.sources){o.innerHTML=d.result.sources.map(s=>'<div style="padding:8px;border-bottom:1px solid var(--border);cursor:pointer;"><span style="font-size:10px;background:var(--surface);padding:1px 6px;border-radius:3px;margin-right:6px;">'+s.thought_category+'</span>'+s.content_preview+'</div>').join('');o.style.display='block';}else{o.style.display='none';}}catch(e){}}
  </script>`;
}

/**
 * renderReleaseManager — Phase-grouped task view with search and release button
 * Part 18 of Structured Knowledge Objects
 */
function renderReleaseManager(tasks) {
  const groups = {};
  for (const t of tasks) {
    const dna = t.dna_json ? JSON.parse(t.dna_json) : {};
    const group = dna.group || 'Ungrouped';
    if (!groups[group]) groups[group] = [];
    groups[group].push({ slug: t.slug, title: dna.title || t.slug, status: t.status, role: dna.role });
  }
  const groupsHtml = Object.entries(groups).map(([phase, items]) => `
    <details open style="margin-bottom:16px;">
      <summary style="cursor:pointer;font-size:16px;font-weight:600;padding:8px 0;">${phase} (${items.length})</summary>
      <div style="padding-left:16px;">
        ${items.map(t => `<div style="padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="font-weight:500;">${t.title}</span>
          <span style="font-size:12px;color:var(--muted);margin-left:8px;">${t.status}</span>
        </div>`).join('')}
      </div>
    </details>`).join('');
  return `<!DOCTYPE html><html><head><title>Release Manager — Mindspace</title>
<style>:root{--bg:#fff;--text:#1a1a2e;--border:#e0e0e0;--muted:#666;--link:#1a56db;--surface:#f5f5f5;}[data-theme="dark"]{--bg:#0f1117;--text:#eee;--border:#333;--muted:#888;--link:#8ab4f8;--surface:#1a1a2e;}body{background:var(--bg);color:var(--text);font-family:sans-serif;margin:0;padding:24px;}.container{max-width:900px;margin:0 auto;}input{padding:8px 12px;width:100%;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:14px;margin-bottom:16px;}</style></head><body>
<div class="container"><h1>Release Manager</h1>
<input type="text" placeholder="Search tasks..." oninput="filterTasks(this.value)">
<div>${groupsHtml}</div>
<div style="margin-top:24px;text-align:right;"><button onclick="if(confirm('Confirm release?'))alert('Release created')" style="padding:10px 20px;background:var(--link);color:#fff;border:none;border-radius:4px;cursor:pointer;">New Release</button></div>
<a href="/" style="display:inline-block;margin-top:16px;color:var(--link);">Back</a></div>
<script>function filterTasks(q){document.querySelectorAll('details div[style*="border-bottom"]').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';});}</script>
</body></html>`;
}

/**
 * renderReadinessBar — Progress bar for mission/capability readiness
 * Part 22 of Structured Knowledge Objects
 */
function renderReadinessBar(readyCount, totalCount) {
  const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const color = pct === 100 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return `<div style="margin:8px 0;"><div style="background:var(--surface);border-radius:4px;height:8px;overflow:hidden;"><div style="width:${pct}%;background:${color};height:100%;border-radius:4px;transition:width 0.3s;"></div></div><span style="font-size:11px;color:var(--muted);">${readyCount}/${totalCount} ready (${pct}%)</span></div>`;
}

/**
 * renderMissionMap — Server-rendered mission map landing page
 * Replaces kanban as root route. Shows mission cards with status badges.
 * Active missions first, deprecated dimmed below.
 */
function renderMissionMap(missions) {
  const statusBadgeColor = (status) => {
    switch (status) {
      case 'active': return '#48bb78';
      case 'draft': return '#4299e1';
      case 'deprecated': return '#a0aec0';
      default: return '#a0aec0';
    }
  };

  const activeMissions = missions.filter(m => m.status === 'active');
  const deprecatedMissions = missions.filter(m => m.status !== 'active');

  const totalCaps = missions.reduce((sum, m) => sum + (m.capabilities || []).length, 0);

  const renderCard = (m, dimmed) => {
    const capCount = (m.capabilities || []).length;
    const color = statusBadgeColor(m.status);
    const cardStyle = dimmed ? 'opacity:0.6;' : '';
    const link = m.short_id ? `/m/${m.short_id}` : `/m/${m.id}`;
    const excerpt = (m.description || '').substring(0, 120);
    return `
      <a href="${link}" class="mission-card" style="${cardStyle}border-left:3px solid ${color};">
        <div class="card-header">
          <h3 class="card-title">${m.title}</h3>
          <span class="status-badge" style="background:${color};">${m.status}</span>
        </div>
        <p class="card-description">${excerpt}${(m.description || '').length > 120 ? '...' : ''}</p>
        <span class="cap-count">${capCount} capabilities</span>
      </a>`;
  };

  const activeCards = activeMissions.map(m => renderCard(m, false)).join('');
  const deprecatedCards = deprecatedMissions.length > 0 ? `
    <section class="deprecated" style="margin-top:32px;">
      <h2 style="font-size:16px;color:#a0aec0;margin-bottom:12px;">Deprecated</h2>
      <div class="mission-grid dimmed">${deprecatedMissions.map(m => renderCard(m, true)).join('')}</div>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mission Map — Mindspace</title>
<style>
:root{--bg:#ffffff;--surface:#f5f5f5;--border:#e0e0e0;--text:#1a1a2e;--muted:#666;--link:#1a56db;}
[data-theme="dark"]{--bg:#0f1117;--surface:#1a1a2e;--border:#333;--text:#eee;--muted:#888;--link:#8ab4f8;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;}
.theme-toggle{position:fixed;top:12px;right:12px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:14px;color:var(--text);z-index:100;}
.container{max-width:900px;margin:0 auto;padding:24px 16px;}
h1{font-size:28px;margin-bottom:8px;}
.subtitle{color:var(--muted);margin-bottom:24px;}
.mission-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.mission-card{display:block;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--text);transition:border-color 0.2s;}
.mission-card:hover{border-color:var(--link);}
.card-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;}
.card-title{font-size:15px;font-weight:600;color:var(--text);}
.status-badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#fff;flex-shrink:0;margin-left:8px;}
.card-description{font-size:13px;color:var(--muted);margin-bottom:8px;}
.cap-count{font-size:11px;color:var(--muted);font-weight:500;}
.footer-stats{margin-top:32px;padding-top:16px;border-top:1px solid var(--border);font-size:13px;color:var(--muted);display:flex;gap:16px;}
@media(max-width:600px){.mission-grid{grid-template-columns:1fr;}}
</style>
</head><body>
<button class="theme-toggle" onclick="toggleTheme()">&#127763;</button>
<script>
function toggleTheme(){const c=document.documentElement.getAttribute('data-theme');const n=c==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n);}
const saved=localStorage.getItem('theme');if(saved==='dark')document.documentElement.setAttribute('data-theme','dark');
</script>
<div class="container">
<h1>Mission Map</h1>
<p class="subtitle">Overview of all missions and their capabilities</p>
<div class="mission-grid">${activeCards}</div>
${deprecatedCards}
<div class="footer-stats">
  <span>${activeMissions.length} active · ${totalCaps} capabilities · <a href="/kanban" style="color:var(--link);text-decoration:none;">Kanban Board</a></span>
</div>
</div></body></html>`;
}

function getMissionOverview() {
  const projects = discoverProjects();
  const currentProject = path.basename(__dirname.replace('/viz', ''));
  const targetProjects = projects.filter(p => p.name === currentProject);
  const allMissions = [];
  for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
    try {
      const db = new Database(proj.dbPath, { readonly: true });
      try {
        const missionRows = db.prepare("SELECT id, slug, title, description, status, short_id FROM missions ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, created_at ASC").all();
        for (const m of missionRows) {
          const caps = db.prepare("SELECT id, title, description, status, sort_order, short_id FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC").all(m.id);
          allMissions.push({ ...m, capabilities: caps });
        }
      } catch (err) { /* tables may not exist */ }
      db.close();
    } catch (err) { /* skip project */ }
  }
  return allMissions;
}

function send404(res, shortId, typePrefix) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html><html><head><title>Not Found — Mindspace</title>
<style>body{margin:0;padding:40px;background:#0f1117;color:#eee;font-family:sans-serif;text-align:center;}a{color:#8ab4f8;}</style></head><body>
<h1>404 — Not Found</h1><p>No ${typePrefix === 'm' ? 'mission' : typePrefix === 'c' ? 'capability' : typePrefix === 'r' ? 'requirement' : 'node'} found with ID <code>${shortId}</code></p>
<p><a href="/">Back to Mindspace</a></p></body></html>`);
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

// Settings are managed by the API server (Express, port 3100).
// The viz catch-all proxy at /api/* forwards settings requests to the API.
// No direct SQLite access from viz — the viz is a frontend, not a data layer.

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
          const missionRows = db.prepare("SELECT id, slug, title, description, status, short_id FROM missions WHERE status = 'active' ORDER BY created_at ASC").all();
          for (const m of missionRows) {
            const caps = db.prepare("SELECT id, title, description, status, sort_order, short_id FROM capabilities WHERE mission_id = ? ORDER BY sort_order ASC").all(m.id);
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
            missions.push({ id: m.id, slug: m.slug, title: m.title, description: m.description, status: m.status, short_id: m.short_id, kb_url: m.short_id ? `/m/${m.short_id}` : null, capabilities: enrichedCaps });
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

  // Settings: /api/settings/* is handled by the API server via catch-all proxy below.
  // No direct SQLite handling — the viz is a frontend.

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
  if (pathname.startsWith('/api/') || pathname.startsWith('/a2a/') || pathname.startsWith('/.well-known/') || pathname === '/authorize' || pathname === '/token' || pathname === '/register' || pathname === '/revoke') {
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
  const kbMatch = pathname.match(KB_ROUTE);
  if (kbMatch) {
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    const projects = discoverProjects();
    const targetProjects = projects.filter(p => p.name === currentProject);
    for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        handleKbRoute(res, kbMatch[1], kbMatch[2], kbMatch[4], db);
        db.close();
        return;
      } catch (err) { /* skip */ }
    }
    send404(res, kbMatch[2], kbMatch[1]);
    return;
  }

  // Serve docs/ directory (diagrams, etc.) from repo root
  if (pathname.startsWith('/docs/')) {
    const repoRoot = path.resolve(__dirname, '..');
    const docPath = path.join(repoRoot, pathname);
    if (docPath.startsWith(repoRoot) && fs.existsSync(docPath)) {
      serveStatic(res, docPath);
      return;
    }
  }

  // Root route: serve mission map
  if (pathname === '/') {
    const missions = getMissionOverview();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderMissionMap(missions));
    return;
  }

  // /kanban or /tasks route: serve kanban index.html
  if (pathname === '/kanban' || pathname === '/tasks') {
    const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
      ? path.resolve(path.join(__dirname, 'active'))
      : __dirname;
    const kanbanPath = path.join(staticRoot, 'index.html');
    serveStatic(res, kanbanPath);
    return;
  }

  // /releases route: serve release manager
  if (pathname === '/releases') {
    const projects = discoverProjects();
    const currentProject = path.basename(__dirname.replace('/viz', ''));
    const targetProjects = projects.filter(p => p.name === currentProject);
    for (const proj of (targetProjects.length ? targetProjects : projects.slice(0, 1))) {
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        const tasks = db.prepare("SELECT slug, status, dna_json FROM mindspace_nodes WHERE type='task' AND status NOT IN ('cancelled')").all();
        db.close();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderReleaseManager(tasks));
        return;
      } catch (e) { /* skip */ }
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderReleaseManager([]));
    return;
  }

  // Static files — serve from active/ symlink directory, fallback to root for shared assets
  const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
    ? path.resolve(path.join(__dirname, 'active'))
    : __dirname;
  let filePath = pathname;
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
