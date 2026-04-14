/**
 * Agent Runtime — Host-side agent manager
 *
 * Runs on the HOST (not in Docker). Manages tmux sessions for Claude Code agents.
 * The container API delegates agent start/stop to this process.
 * Agents survive container restarts because they run here, not in Docker.
 *
 * Endpoints:
 *   POST /spawn    — create tmux session + start Claude Code
 *   POST /stop     — kill tmux session
 *   GET  /running  — list running agent sessions
 *   GET  /health   — runtime health
 *   WS   /ws/terminal/:sessionName — PTY stream to tmux
 *
 * Usage:
 *   node scripts/agent-runtime.js              # start runtime
 *   RUNTIME_PORT=3101 node scripts/agent-runtime.js  # custom port
 */

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKSPACE = dirname(__dirname);

const PORT = parseInt(process.env.RUNTIME_PORT || '3101', 10);
const API_PORT = process.env.API_PORT || '3100';
const ROLES = ['liaison', 'pdsa', 'dev', 'qa'];

// --- HTTP Server ---

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');

  // Health
  if (req.method === 'GET' && url.pathname === '/health') {
    res.end(JSON.stringify({ status: 'ok', pid: process.pid, uptime: process.uptime() }));
    return;
  }

  // List running agents
  if (req.method === 'GET' && url.pathname === '/running') {
    const running = [];
    for (const role of ROLES) {
      try {
        const sessions = execFileSync('tmux', ['list-sessions', '-F', '#{session_name}'], { stdio: 'pipe' }).toString().trim().split('\n');
        for (const s of sessions) {
          if (s.startsWith('agent-')) {
            const parts = s.replace('agent-', '').split('-');
            const r = parts[0];
            const userId = parts.slice(1).join('-');
            if (ROLES.includes(r)) {
              running.push({ role: r, sessionName: s, status: 'running' });
            }
          }
        }
      } catch { /* no tmux server */ }
      break; // only need to list once
    }
    // Deduplicate
    const unique = [...new Map(running.map(a => [a.sessionName, a])).values()];
    res.end(JSON.stringify(unique));
    return;
  }

  // Parse JSON body for POST
  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body); } catch { /* empty */ }

    // Spawn agent
    if (url.pathname === '/spawn') {
      const { sessionName, role, userId, agentJwt } = data;
      if (!sessionName || !role || !userId) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'sessionName, role, userId required' }));
        return;
      }

      // Check if already running
      try {
        execFileSync('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
        res.end(JSON.stringify({ sessionName, status: 'running', message: 'Already running' }));
        return;
      } catch { /* doesn't exist — create it */ }

      try {
        const env = {
          ...process.env,
          AGENT_JWT: agentJwt || '',
          API_PORT: API_PORT,
        };

        execFileSync('tmux', [
          'new-session', '-d', '-s', sessionName, '-x', '120', '-y', '40'
        ], { env, stdio: 'pipe' });

        execFileSync('tmux', [
          'send-keys', '-t', sessionName,
          `bash ${join(WORKSPACE, 'scripts', 'start-agent.sh')} ${role} ${userId}`, 'Enter'
        ], { env, stdio: 'pipe' });

        res.writeHead(201);
        res.end(JSON.stringify({ sessionName, role, userId, status: 'starting' }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: `Failed to spawn: ${err.message}` }));
      }
      return;
    }

    // Stop agent
    if (url.pathname === '/stop') {
      const { sessionName } = data;
      if (!sessionName) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'sessionName required' }));
        return;
      }

      try {
        execFileSync('tmux', ['kill-session', '-t', sessionName], { stdio: 'pipe' });
      } catch { /* session may not exist */ }

      res.end(JSON.stringify({ stopped: sessionName }));
      return;
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// --- WebSocket for terminal PTY ---

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (!url.pathname.startsWith('/ws/terminal/')) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const sessionName = url.pathname.split('/').pop() || 'default';

    // Check session exists
    try {
      execFileSync('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
    } catch {
      ws.close();
      return;
    }

    // Spawn PTY via node-pty (dynamic import for native module)
    import('node-pty').then(pty => {
      const spawn = pty.spawn || pty.default?.spawn;
      const term = spawn('tmux', ['attach-session', '-t', sessionName], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: WORKSPACE,
        env: { ...process.env, TERM: 'xterm-256color' },
      });

      // PTY → WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });

      // WebSocket → PTY
      ws.on('message', (data) => {
        const msg = data.toString();
        if (msg.startsWith('{"type":"resize"')) {
          try {
            const { cols, rows } = JSON.parse(msg);
            if (cols && rows) term.resize(cols, rows);
          } catch { /* ignore */ }
          return;
        }
        term.write(msg);
      });

      ws.on('close', () => term.kill());
      ws.on('error', () => term.kill());
      term.onExit(() => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
    }).catch(() => {
      ws.close();
    });
  });
});

// --- Start ---

const SOCKET_PATH = process.env.RUNTIME_SOCKET || '/tmp/agent-runtime.sock';
const USE_SOCKET = process.env.RUNTIME_MODE !== 'tcp';

import { unlinkSync } from 'node:fs';

if (USE_SOCKET) {
  try { unlinkSync(SOCKET_PATH); } catch { /* doesn't exist */ }
  server.listen(SOCKET_PATH, () => {
    // Make socket accessible from Docker (world-writable)
    try { execFileSync('chmod', ['777', SOCKET_PATH]); } catch { /* */ }
    console.log(`[agent-runtime] listening on ${SOCKET_PATH}`);
    console.log(`[agent-runtime] workspace: ${WORKSPACE}`);
  });
} else {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[agent-runtime] listening on 0.0.0.0:${PORT}`);
    console.log(`[agent-runtime] workspace: ${WORKSPACE}`);
  });
}
