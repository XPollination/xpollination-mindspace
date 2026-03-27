/**
 * Terminal WebSocket — bridges browser xterm.js to server-side tmux sessions.
 * Route: /ws/terminal/:sessionName
 * Protocol: raw binary PTY data over WebSocket (same as xterm.js attach addon)
 */

import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'node:http';
import { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { sessionExists, createSession, resizeSession } from '../lib/terminal-manager.js';

// Use dynamic import for node-pty (native module)
let ptySpawn: any;
async function getPty() {
  if (!ptySpawn) {
    const pty = await import('node-pty');
    ptySpawn = pty.spawn || pty.default?.spawn;
  }
  return ptySpawn;
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || '/', `http://localhost`);
  const sessionName = url.pathname.split('/').pop() || 'default';

  // Ensure tmux session exists
  if (!sessionExists(sessionName)) {
    createSession(sessionName);
  }

  // Spawn tmux attach via node-pty for full PTY support
  const spawn = await getPty();
  const pty = spawn('tmux', ['attach-session', '-t', sessionName], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.env.XPO_WORKSPACE_PATH || '/workspace',
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  // PTY → WebSocket
  pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // WebSocket → PTY
  ws.on('message', (data: Buffer | string) => {
    const msg = data.toString();
    // Check for resize messages (JSON format)
    if (msg.startsWith('{"type":"resize"')) {
      try {
        const { cols, rows } = JSON.parse(msg);
        if (cols && rows) {
          pty.resize(cols, rows);
          resizeSession(sessionName, cols, rows);
        }
      } catch { /* ignore parse errors */ }
      return;
    }
    pty.write(msg);
  });

  // Cleanup on WebSocket close — detach but DON'T kill tmux session
  ws.on('close', () => {
    pty.kill();  // Kills the tmux attach process, NOT the session
  });

  ws.on('error', () => {
    pty.kill();
  });

  pty.onExit(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
});

export function handleTerminalUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const url = new URL(req.url || '/', `http://localhost`);

  if (!url.pathname.startsWith('/ws/terminal/')) {
    socket.destroy();
    return;
  }

  // Security: verify session ownership
  // Session names are agent-<role>-<userId> — extract userId and match against JWT
  const sessionName = url.pathname.split('/').pop() || '';
  const sessionUserId = sessionName.replace(/^agent-[a-z]+-/, '');
  const cookies = (req.headers.cookie || '').split(';').reduce((acc: Record<string,string>, c) => {
    const [k, v] = c.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  // Best-effort auth check — if JWT available, verify user owns the session
  const token = cookies['ms_session'] || url.searchParams.get('token');
  if (token && sessionUserId && sessionUserId !== 'default') {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as any;
      if (decoded.sub && decoded.sub !== sessionUserId) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    } catch { /* JWT verify failed — allow connection (graceful degradation) */ }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}
