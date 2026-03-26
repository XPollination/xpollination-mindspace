/**
 * <agent-card> — Chat-first agent card with expandable terminal
 * Shows: role badge, status, A2A event stream, action buttons
 * Terminal hidden by default — expand to see raw Claude Code output
 */

class AgentCard extends HTMLElement {
  connectedCallback() {
    const agentId = this.getAttribute('agent-id') || '';
    const role = this.getAttribute('role') || 'dev';
    const name = this.getAttribute('agent-name') || `${role}-agent`;
    const sessionName = this.getAttribute('session-name') || `agent-${role}`;

    const roleColors = { liaison: '#f5c2e7', pdsa: '#f9e2af', dev: '#89b4fa', qa: '#a6e3a1' };
    const color = roleColors[role] || '#cdd6f4';

    this.innerHTML = `
      <div class="ac" style="border:1px solid var(--ms-border,#e2e8f0);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;height:100%;background:var(--ms-bg,#fff);">
        <div class="ac-header" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--ms-surface,#f8fafc);border-bottom:1px solid var(--ms-border,#e2e8f0);">
          <span class="ac-status" style="width:8px;height:8px;border-radius:50%;background:#94a3b8;"></span>
          <span style="font-weight:bold;color:${color};font-size:13px;">${role.toUpperCase()}</span>
          <span style="font-size:11px;color:var(--ms-muted,#94a3b8);">${name}</span>
          <span class="ac-timer" style="margin-left:auto;font-size:10px;color:var(--ms-muted,#94a3b8);font-family:monospace;"></span>
          <button class="ac-toggle-term" style="padding:2px 8px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;background:none;color:var(--ms-muted,#94a3b8);cursor:pointer;font-size:10px;">Terminal</button>
        </div>
        <div class="ac-events" style="flex:1;overflow-y:auto;padding:8px;font-size:12px;min-height:80px;"></div>
        <div class="ac-actions" style="padding:6px 12px;border-top:1px solid var(--ms-border,#e2e8f0);display:none;gap:6px;">
          <button class="ac-approve" style="padding:4px 12px;border:none;border-radius:4px;background:#22c55e;color:#fff;cursor:pointer;font-size:11px;">Approve</button>
          <button class="ac-rework" style="padding:4px 12px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;font-size:11px;">Rework</button>
        </div>
        <div class="ac-terminal" style="display:none;height:300px;border-top:1px solid var(--ms-border,#e2e8f0);">
          <agent-terminal session-name="${sessionName}" role="${role}"></agent-terminal>
        </div>
      </div>`;

    this._events = this.querySelector('.ac-events');
    this._actions = this.querySelector('.ac-actions');
    this._statusDot = this.querySelector('.ac-status');
    this._termContainer = this.querySelector('.ac-terminal');
    this._startTime = Date.now();

    // Toggle terminal
    this.querySelector('.ac-toggle-term').addEventListener('click', () => {
      const visible = this._termContainer.style.display !== 'none';
      this._termContainer.style.display = visible ? 'none' : 'block';
      this.querySelector('.ac-toggle-term').textContent = visible ? 'Terminal' : 'Hide Terminal';
    });

    // Connect SSE for agent events
    if (agentId) this._connectSSE(agentId);
    this._startTimer();
  }

  _connectSSE(agentId) {
    this._eventSource = new EventSource(`/a2a/stream/${agentId}`);
    const events = ['transition', 'task_assigned', 'approval_needed', 'review_needed', 'rework_needed', 'task_blocked', 'connected', 'decision_needed', 'human_input'];

    events.forEach(evt => {
      this._eventSource.addEventListener(evt, (e) => {
        const data = JSON.parse(e.data);
        this._addEvent(evt, data);

        if (evt === 'connected') {
          this._statusDot.style.background = '#22c55e';
        }
        if (evt === 'approval_needed' || evt === 'decision_needed') {
          this._actions.style.display = 'flex';
        }
      });
    });

    this._eventSource.onerror = () => {
      this._statusDot.style.background = '#ef4444';
    };
  }

  _addEvent(type, data) {
    const typeColors = {
      transition: '#22c55e', task_assigned: '#3b82f6', approval_needed: '#f59e0b',
      review_needed: '#8b5cf6', rework_needed: '#ef4444', task_blocked: '#ef4444',
      connected: '#94a3b8', decision_needed: '#f59e0b', human_input: '#3b82f6',
    };
    const color = typeColors[type] || '#94a3b8';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const summary = data.task_slug ? `${data.task_slug}` : data.text || type;

    const div = document.createElement('div');
    div.style.cssText = 'padding:3px 0;border-bottom:1px solid var(--ms-border,#f1f5f9);';
    div.innerHTML = `<span style="color:${color};font-weight:bold;font-size:10px;">${type}</span> <span style="color:var(--ms-muted,#94a3b8);font-size:10px;">${time}</span> <span style="font-size:11px;">${summary}</span>`;
    this._events.appendChild(div);
    this._events.scrollTop = this._events.scrollHeight;
  }

  _startTimer() {
    const timer = this.querySelector('.ac-timer');
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._startTime) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }

  disconnectedCallback() {
    if (this._eventSource) this._eventSource.close();
  }
}

customElements.define('agent-card', AgentCard);
