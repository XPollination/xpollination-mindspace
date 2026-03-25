/**
 * Agent Panel — real-time agent activity stream via SSE
 * Web component: <agent-panel agent-id="UUID" role="dev">
 */

const EVENT_ICONS = {
  transition: '→', object_create: '+', object_update: '✎',
  task_assigned: '📥', approval_needed: '⏳', review_needed: '🔍',
  rework_needed: '↩', task_blocked: '⛔', connected: '●',
};

const EVENT_COLORS = {
  transition: '#8be9fd', object_create: '#50fa7b', object_update: '#f1fa8c',
  task_assigned: '#ff79c6', approval_needed: '#ffb86c', review_needed: '#bd93f9',
  rework_needed: '#ff5555', task_blocked: '#ff5555', connected: '#50fa7b',
};

class AgentPanel extends HTMLElement {
  constructor() {
    super();
    this._events = [];
    this._paused = false;
    this._eventSource = null;
  }

  connectedCallback() {
    const agentId = this.getAttribute('agent-id');
    const role = this.getAttribute('role') || 'agent';
    const name = this.getAttribute('agent-name') || `${role}-agent`;

    this.innerHTML = `
      <div class="agent-panel" style="display:flex;flex-direction:column;height:100%;background:#1e1e2e;color:#cdd6f4;font-family:monospace;border:1px solid #45475a;border-radius:6px;overflow:hidden;">
        <div class="ap-header" style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#313244;border-bottom:1px solid #45475a;cursor:grab;">
          <span class="ap-status" style="width:8px;height:8px;border-radius:50%;background:#50fa7b;"></span>
          <span class="ap-name" style="font-weight:bold;flex:1;">${name}</span>
          <span class="ap-role" style="font-size:11px;padding:1px 6px;border-radius:3px;background:#45475a;">${role}</span>
          <span class="ap-time" style="font-size:11px;color:#6c7086;">0:00</span>
          <button class="ap-btn ap-pause" title="Pause" style="background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:14px;">⏸</button>
          <button class="ap-btn ap-stop" title="Stop" style="background:none;border:none;color:#f38ba8;cursor:pointer;font-size:14px;">⏹</button>
          <button class="ap-btn ap-fullscreen" title="Fullscreen" style="background:none;border:none;color:#cdd6f4;cursor:pointer;font-size:14px;">⛶</button>
        </div>
        <div class="ap-stream" style="flex:1;overflow-y:auto;padding:6px 10px;font-size:12px;line-height:1.6;"></div>
        <div class="ap-input" style="display:flex;border-top:1px solid #45475a;">
          <input type="text" class="ap-text" placeholder="Send message..." style="flex:1;background:#181825;border:none;color:#cdd6f4;padding:6px 10px;font-family:monospace;font-size:12px;outline:none;" />
          <button class="ap-send" style="background:#45475a;border:none;color:#cdd6f4;padding:6px 12px;cursor:pointer;">Send</button>
        </div>
      </div>
    `;

    // Wire buttons
    this.querySelector('.ap-pause').addEventListener('click', () => this._togglePause());
    this.querySelector('.ap-stop').addEventListener('click', () => this._stopAgent(agentId));
    this.querySelector('.ap-fullscreen').addEventListener('click', () => this._toggleFullscreen());
    this.querySelector('.ap-send').addEventListener('click', () => this._sendMessage(agentId));
    this.querySelector('.ap-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendMessage(agentId); });

    // Connect SSE
    if (agentId) this._connectSSE(agentId);

    // Timer
    this._startTime = Date.now();
    this._timer = setInterval(() => this._updateTime(), 1000);
  }

  disconnectedCallback() {
    if (this._eventSource) this._eventSource.close();
    if (this._timer) clearInterval(this._timer);
  }

  _connectSSE(agentId) {
    const baseUrl = window.location.origin;
    this._eventSource = new EventSource(`${baseUrl}/a2a/stream/${agentId}`);

    for (const eventType of Object.keys(EVENT_ICONS)) {
      this._eventSource.addEventListener(eventType, (e) => {
        const data = JSON.parse(e.data);
        this._addEvent(eventType, data);
      });
    }

    this._eventSource.onerror = () => {
      this._setStatus('disconnected');
    };

    this._addEvent('connected', { message: 'Stream connected' });
  }

  _addEvent(type, data) {
    this._events.push({ type, data, timestamp: new Date() });
    if (!this._paused) this._renderEvent(type, data);
  }

  _renderEvent(type, data) {
    const stream = this.querySelector('.ap-stream');
    if (!stream) return;
    const icon = EVENT_ICONS[type] || '•';
    const color = EVENT_COLORS[type] || '#6c7086';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const summary = data.task_slug || data.message || data.object_type || type;
    const line = document.createElement('div');
    line.innerHTML = `<span style="color:#6c7086">${time}</span> <span style="color:${color}">${icon}</span> <span style="color:${color};font-weight:bold">${type}</span> ${summary}`;
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;
  }

  _togglePause() {
    this._paused = !this._paused;
    this.querySelector('.ap-pause').textContent = this._paused ? '▶' : '⏸';
    if (!this._paused) {
      // Render queued events
      const stream = this.querySelector('.ap-stream');
      for (const ev of this._events.slice(-50)) this._renderEvent(ev.type, ev.data);
    }
  }

  async _stopAgent(agentId) {
    try {
      await fetch(`/api/agents/${agentId}/stop`, { method: 'POST' });
      this._setStatus('stopped');
      if (this._eventSource) this._eventSource.close();
      this.querySelector('.ap-text').disabled = true;
      this.querySelector('.ap-send').disabled = true;
    } catch { /* ignore */ }
  }

  _toggleFullscreen() {
    this.classList.toggle('fullscreen');
    this.dispatchEvent(new CustomEvent('fullscreen-toggle', { detail: { agentId: this.getAttribute('agent-id') } }));
  }

  async _sendMessage(agentId) {
    const input = this.querySelector('.ap-text');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    try {
      await fetch('/a2a/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'HUMAN_INPUT', agent_id: agentId, payload: { text } }),
      });
      this._renderEvent('sent', { message: text });
    } catch { /* ignore */ }
  }

  _setStatus(status) {
    const dot = this.querySelector('.ap-status');
    if (dot) dot.style.background = status === 'stopped' ? '#f38ba8' : status === 'disconnected' ? '#fab387' : '#50fa7b';
  }

  _updateTime() {
    const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    const el = this.querySelector('.ap-time');
    if (el) el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
  }
}

customElements.define('agent-panel', AgentPanel);
