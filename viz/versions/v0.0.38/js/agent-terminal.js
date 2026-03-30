/**
 * <agent-terminal> — xterm.js web component connected to server-side tmux
 * Attributes: session-name, role
 * No external dependencies beyond xterm.js (loaded from CDN)
 */

// Load xterm.js from CDN if not already loaded
if (!window.Terminal) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.min.css';
  document.head.appendChild(link);

  await import('https://cdn.jsdelivr.net/npm/@xterm/xterm@5/+esm').then(m => {
    window.Terminal = m.Terminal;
  });
  await import('https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0/+esm').then(m => {
    window.FitAddon = m.FitAddon;
  });
  await import('https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0/+esm').then(m => {
    window.WebLinksAddon = m.WebLinksAddon;
  });
}

class AgentTerminal extends HTMLElement {
  connectedCallback() {
    const sessionName = this.getAttribute('session-name') || 'default';
    const role = this.getAttribute('role') || 'dev';

    this.innerHTML = `<div class="at-container" style="width:100%;height:100%;background:#1e1e2e;border-radius:6px;overflow:hidden;">
      <div class="at-header" style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#181825;font-size:11px;color:#cdd6f4;">
        <span style="color:#f5c2e7;">●</span>
        <span>${role.toUpperCase()}</span>
        <span style="color:#6c7086;margin-left:auto;font-family:monospace;font-size:10px;">${sessionName}</span>
      </div>
      <div class="at-term" style="flex:1;"></div>
    </div>`;

    this._initTerminal(sessionName);
  }

  _initTerminal(sessionName) {
    const container = this.querySelector('.at-term');
    const term = new window.Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#45475a',
        black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
        blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
        brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5', brightWhite: '#a6adc8',
      },
      allowProposedApi: true,
    });

    const fitAddon = new window.FitAddon();
    term.loadAddon(fitAddon);
    const webLinksAddon = new window.WebLinksAddon();
    term.loadAddon(webLinksAddon);
    term.open(container);

    // Placeholder immediately — terminal is rendered, connection hasn't started
    term.write('\x1b[36m  Connecting to agent session...\x1b[0m\r\n\r\n');
    term.write('\x1b[90m  Waiting for Claude to authenticate.\x1b[0m\r\n');
    term.write('\x1b[90m  If this is a new session, complete OAuth in the terminal.\x1b[0m\r\n');

    // Fit after a tick (container needs to be rendered)
    requestAnimationFrame(() => {
      fitAddon.fit();
      this._connectWS(term, sessionName, fitAddon);
    });

    // Re-fit on resize
    const ro = new ResizeObserver(() => fitAddon.fit());
    ro.observe(container);
    this._cleanup = () => { ro.disconnect(); term.dispose(); };
  }

  _connectWS(term, sessionName, fitAddon) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws/terminal/${sessionName}`);
    this._ws = ws;

    ws.onopen = () => {
      this._hasConnected = true;
      const { cols, rows } = term;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    let firstData = true;
    ws.onmessage = (e) => {
      if (firstData) { term.clear(); firstData = false; }
      term.write(e.data);
    };

    ws.onclose = () => {
      if (!this._hasConnected) {
        term.clear();
        term.write('\x1b[36m  Agent session not ready.\x1b[0m\r\n\r\n');
        term.write('\x1b[90m  The agent will appear here after authentication.\x1b[0m\r\n');
        term.write('\x1b[90m  Retrying...\x1b[0m\r\n');
      } else {
        term.write('\r\n\x1b[33m  [disconnected — reconnecting...]\x1b[0m\r\n');
      }
      setTimeout(() => this._connectWS(term, sessionName, fitAddon), 3000);
    };

    ws.onerror = () => ws.close();

    // Input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    // Resize → WebSocket
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
  }

  disconnectedCallback() {
    if (this._ws) this._ws.close();
    if (this._cleanup) this._cleanup();
  }
}

customElements.define('agent-terminal', AgentTerminal);
