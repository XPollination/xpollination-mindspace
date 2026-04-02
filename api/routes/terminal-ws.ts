/**
 * Terminal WebSocket — bridges browser xterm.js to agent tmux sessions.
 * Route: /ws/terminal/:sessionName
 *
 * Proxies WebSocket to the host agent runtime (agents run on host, not in Docker).
 * Falls back to local tmux attach if runtime is unavailable.
 */

import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'node:http';
import { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { sessionExists, resizeSession } from '../lib/terminal-manager.js';

const RUNTIME_URL = process.env.AGENT_RUNTIME_URL || 'http://host.docker.internal:3101';
const RUNTIME_WS = RUNTIME_URL.replace('http://', 'ws://').replace('https://', 'wss://');

// Use dynamic import for node-pty (native module, fallback only)
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

  // If session exists locally, attach directly (no proxy roundtrip)
  if (sessionExists(sessionName)) {
    fallbackToLocalTmux(ws, sessionName);
    return;
  }

  // Try to proxy to host agent runtime (for sessions on the host machine)
  try {
    const upstream = new WebSocket(`${RUNTIME_WS}/ws/terminal/${sessionName}`);

    upstream.on('open', () => {
      ws.on('message', (data) => {
        if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
      });
    });

    upstream.on('message', (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    upstream.on('close', () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    });

    upstream.on('error', () => {
      upstream.close();
      fallbackToLocalTmux(ws, sessionName);
    });

    ws.on('close', () => upstream.close());
    ws.on('error', () => upstream.close());

  } catch {
    fallbackToLocalTmux(ws, sessionName);
  }
});

async function fallbackToLocalTmux(ws: WebSocket, sessionName: string) {
  if (!sessionExists(sessionName)) {
    ws.close();
    return;
  }

  const spawn = await getPty();
  const pty = spawn('tmux', ['attach-session', '-t', sessionName], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.env.XPO_WORKSPACE_PATH || '/workspace',
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  });

  ws.on('message', (data: Buffer | string) => {
    const msg = data.toString();
    if (msg.startsWith('{"type":"resize"')) {
      try {
        const { cols, rows } = JSON.parse(msg);
        if (cols && rows) { pty.resize(cols, rows); resizeSession(sessionName, cols, rows); }
      } catch { /* */ }
      return;
    }
    pty.write(msg);
  });

  ws.on('close', () => pty.kill());
  ws.on('error', () => pty.kill());
  pty.onExit(() => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
}

export function handleTerminalUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const url = new URL(req.url || '/', `http://localhost`);

  if (!url.pathname.startsWith('/ws/terminal/')) {
    socket.destroy();
    return;
  }

  const sessionName = url.pathname.split('/').pop() || '';
  const sessionUserId = sessionName.replace(/^agent-[a-z]+-/, '');
  const cookies = (req.headers.cookie || '').split(';').reduce((acc: Record<string,string>, c) => {
    const [k, v] = c.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['ms_session'] || url.searchParams.get('token');
  if (token && sessionUserId && sessionUserId !== 'default') {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme') as any;
      if (decoded.sub && decoded.sub !== sessionUserId) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
    } catch { /* allow */ }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}
