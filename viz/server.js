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
// Database import removed — Phase 6 (Model B): viz is a renderer, not a data layer

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
// discoverProjects removed — Phase 6 (Model B): projects come from API, not filesystem scanning
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
  '/.well-known/',
  '/authorize',
  '/token',
  '/revoke',
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

  // All /api/* routes (projects, missions, capabilities, tasks, data, etc.)
  // handled by catch-all proxy to API server below.
  // No direct SQLite access — the viz is a renderer, not a data layer.
  // Phase 6 (Model B): ~400 lines of direct-SQLite /api/* handlers removed.
  // (mission-overview, capabilities, tasks, suspect-links, data export, projects)
  // All handled by catch-all proxy to API server.

  // PHASE-6-REMOVAL-MARKER
  // API: Get current viz version from active symlink (reads filesystem, not SQLite)
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

  // All settings, node actions, and other /api/* routes: catch-all proxy below.

  // SSE streaming proxy: pipe /a2a/stream/* without buffering (EventSource needs streaming)
  if (pathname.startsWith('/a2a/stream/')) {
    const cookies = parseCookies(req);
    const proxyHeaders = { ...req.headers, host: `localhost:${API_PORT}` };
    if (cookies.ms_session) proxyHeaders['authorization'] = `Bearer ${cookies.ms_session}`;
    const apiReq = http.request({
      hostname: 'localhost', port: API_PORT, path: pathname + url.search,
      method: 'GET', headers: proxyHeaders
    }, (apiRes) => {
      res.writeHead(apiRes.statusCode, apiRes.headers);
      apiRes.pipe(res);
    });
    apiReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API server unreachable' }));
    });
    req.on('close', () => apiReq.destroy());
    apiReq.end();
    return;
  }

  // Catch-all API proxy: any /api/* or /a2a/* not handled above → forward to API server
  // Note: /register is a user page (register.html), NOT the OAuth dynamic client registration endpoint.
  // OAuth /register is POST-only and handled by the API's MCP OAuth router directly.
  if (pathname.startsWith('/api/') || pathname.startsWith('/a2a/') || pathname.startsWith('/.well-known/') || pathname === '/authorize' || pathname === '/token' || pathname === '/revoke') {
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

  // Knowledge Browser routes: /m/:id/:slug?, /c/:id/:slug?, /r/:id/:slug?
  // Client-rendered via A2A (Model B) — serve knowledge.html, JS handles data loading
  const kbMatch = pathname.match(/^\/(m|c|r)\/([a-zA-Z0-9]{1,12})(\/[^.]*)?(\.\w+)?$/);
  if (kbMatch) {
    const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
      ? path.resolve(path.join(__dirname, 'active'))
      : __dirname;
    serveStatic(res, path.join(staticRoot, 'knowledge.html'));
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

  // Root route: serve client-rendered Mission Map (Model B — browser as A2A client)
  if (pathname === '/') {
    const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
      ? path.resolve(path.join(__dirname, 'active'))
      : __dirname;
    serveStatic(res, path.join(staticRoot, 'mission-map.html'));
    return;
  }

  // /kanban or /tasks route: serve new A2A-powered kanban
  if (pathname === '/kanban' || pathname === '/tasks') {
    const staticRoot = fs.existsSync(path.join(__dirname, 'active'))
      ? path.resolve(path.join(__dirname, 'active'))
      : __dirname;
    serveStatic(res, path.join(staticRoot, 'kanban.html'));
    return;
  }

  // /releases route: redirect to kanban for now (release manager will be client-rendered later)
  if (pathname === '/releases') {
    res.writeHead(302, { 'Location': '/kanban' });
    res.end();
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
  console.log(`Viz server running at http://${BIND_HOST}:${PORT} (Model B — browser as A2A client)`);
  console.log(`Static root: ${__dirname}`);
});
