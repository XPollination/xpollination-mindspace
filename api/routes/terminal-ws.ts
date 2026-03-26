/**
 * Terminal WebSocket — bridges browser xterm.js to server-side tmux sessions.
 * Route: /ws/terminal/:sessionName
 * Protocol: raw binary PTY data over WebSocket (same as xterm.js attach addon)
 */

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

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}
