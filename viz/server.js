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
const WORKSPACE_PATH = '/home/developer/workspaces/github/PichlerThomas';

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
const server = http.createServer((req, res) => {
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

server.listen(PORT, () => {
  console.log(`Viz server running at http://localhost:${PORT}`);
  console.log(`Workspace: ${WORKSPACE_PATH}`);
  const projects = discoverProjects();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.name).join(', ')}`);
});
