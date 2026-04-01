/**
 * <agent-grid> — Responsive agent layout with Dashboard/Team view toggle
 * Dashboard: agent cards (events, expandable terminal, stop button)
 * Team: full-size terminal grid (all agents side by side)
 */

class AgentGrid extends HTMLElement {
  connectedCallback() {
    this._view = 'dashboard';
    this._agents = [];

    this.innerHTML = `
      <div class="ag" style="display:flex;flex-direction:column;height:100%;">
        <div class="ag-toolbar" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--ms-surface,#f8fafc);border-bottom:1px solid var(--ms-border,#e2e8f0);">
          <span style="font-weight:bold;">Agent OS</span>
          <button class="ag-spawn" style="padding:4px 12px;border:none;border-radius:4px;background:var(--ms-accent,#ea580c);color:#fff;cursor:pointer;font-weight:bold;font-size:12px;">+ Full Team</button>
          <button class="ag-add-role" data-role="liaison" style="padding:4px 8px;border:none;border-radius:4px;background:var(--ms-role-liaison,#6366f1);color:#fff;cursor:pointer;font-size:11px;">+Liaison</button>
          <button class="ag-add-role" data-role="pdsa" style="padding:4px 8px;border:none;border-radius:4px;background:var(--ms-role-pdsa,#8b5cf6);color:#fff;cursor:pointer;font-size:11px;">+PDSA</button>
          <button class="ag-add-role" data-role="dev" style="padding:4px 8px;border:none;border-radius:4px;background:var(--ms-role-dev,#22c55e);color:#fff;cursor:pointer;font-size:11px;">+Dev</button>
          <button class="ag-add-role" data-role="qa" style="padding:4px 8px;border:none;border-radius:4px;background:var(--ms-role-qa,#eab308);color:#fff;cursor:pointer;font-size:11px;">+QA</button>
          <button class="ag-stop-all" style="padding:4px 12px;border:none;border-radius:4px;background:#ef4444;color:#fff;cursor:pointer;font-weight:bold;font-size:12px;display:none;">Stop All</button>
          <div style="margin-left:auto;display:flex;gap:4px;">
            <button class="ag-view-dash" style="padding:3px 10px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;background:var(--ms-accent,#ea580c);color:#fff;cursor:pointer;font-size:11px;">Dashboard</button>
            <button class="ag-view-term" style="padding:3px 10px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;background:none;color:var(--ms-text,#1e293b);cursor:pointer;font-size:11px;">Team</button>
          </div>
        </div>
        <div class="ag-grid" style="flex:1;display:grid;gap:8px;padding:8px;overflow:auto;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));">
          <div class="ag-empty" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;color:var(--ms-muted,#94a3b8);font-size:14px;padding:40px;">
            No agents running. Click <strong style="margin:0 4px;">+ Start Agentic Team</strong> to begin.
          </div>
        </div>
      </div>`;

    this._grid = this.querySelector('.ag-grid');
    this._empty = this.querySelector('.ag-empty');
    this._stopAllBtn = this.querySelector('.ag-stop-all');

    // View toggle
    this.querySelector('.ag-view-dash').addEventListener('click', () => this._setView('dashboard'));
    this.querySelector('.ag-view-term').addEventListener('click', () => this._setView('terminal'));

    // Start full team
    this.querySelector('.ag-spawn').addEventListener('click', () => this._spawnFullTeam());

    // Per-role add buttons
    this.querySelectorAll('.ag-add-role').forEach(btn => {
      btn.addEventListener('click', () => this._addAgent(btn.dataset.role));
    });

    // Stop all
    this._stopAllBtn.addEventListener('click', () => this._stopAll());

    // Check for existing agents
    this._loadExistingAgents();
  }

  _setView(view) {
    this._view = view;
    const dashBtn = this.querySelector('.ag-view-dash');
    const termBtn = this.querySelector('.ag-view-term');

    if (view === 'dashboard') {
      dashBtn.style.background = 'var(--ms-accent,#ea580c)';
      dashBtn.style.color = '#fff';
      termBtn.style.background = 'none';
      termBtn.style.color = 'var(--ms-text,#1e293b)';
      this._grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(400px,1fr))';
    } else {
      termBtn.style.background = 'var(--ms-accent,#ea580c)';
      termBtn.style.color = '#fff';
      dashBtn.style.background = 'none';
      dashBtn.style.color = 'var(--ms-text,#1e293b)';
      this._grid.style.gridTemplateColumns = '1fr 1fr';
    }

    this._renderAgents();
  }

  async _addAgent(role) {
    try {
      const project = this._getProject();
      const res = await fetch(`/api/team/${project}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        this._agents.push({ role, id: data.id, status: data.status || 'ready' });
      }
    } catch { /* ignore */ }
    this._renderAgents();
  }

  async _spawnFullTeam() {
    try {
      const project = this._getProject();
      const res = await fetch(`/api/team/${project}/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.agents) {
        for (const agent of data.agents) {
          if (!this._agents.find(a => a.role === agent.role)) {
            this._agents.push({ role: agent.role, id: agent.id, status: agent.status || 'ready' });
          }
        }
      }
    } catch { /* ignore */ }
    this._renderAgents();
  }

  _getProject() {
    // Get current project from URL or default
    const params = new URLSearchParams(window.location.search);
    return params.get('project') || 'mindspace';
  }

  async _stopAgent(id, role) {
    try {
      const project = this._getProject();
      await fetch(`/api/team/${project}/agent/${id}`, { method: 'DELETE' });
    } catch { /* best effort */ }
    this._agents = this._agents.filter(a => a.id !== id);
    this._renderAgents();
  }

  async _stopAll() {
    for (const agent of [...this._agents]) {
      try {
        const project = this._getProject();
        await fetch(`/api/team/${project}/agent/${agent.id}`, { method: 'DELETE' });
      } catch { /* continue */ }
    }
    this._agents = [];
    this._renderAgents();
  }

  _renderAgents() {
    if (this._agents.length === 0) {
      this._empty.style.display = 'flex';
      this._stopAllBtn.style.display = 'none';
      return;
    }
    this._empty.style.display = 'none';
    this._stopAllBtn.style.display = 'inline-block';

    // Remove existing agent elements
    this._grid.querySelectorAll('agent-card, agent-terminal').forEach(el => el.remove());

    for (const agent of this._agents) {
      if (this._view === 'dashboard') {
        const card = document.createElement('agent-card');
        card.setAttribute('agent-id', agent.agentId);
        card.setAttribute('role', agent.role);
        card.setAttribute('agent-name', `${agent.role}-agent`);
        card.setAttribute('session-name', agent.sessionName);
        card.setAttribute('stoppable', 'true');
        card.addEventListener('stop-agent', () => this._stopAgent(agent.sessionName, agent.role));
        this._grid.appendChild(card);
      } else {
        const term = document.createElement('agent-terminal');
        term.setAttribute('session-name', agent.sessionName);
        term.setAttribute('role', agent.role);
        term.style.height = 'calc(50vh - 70px)';
        this._grid.appendChild(term);
      }
    }
  }

  async _loadExistingAgents() {
    try {
      // Check actual running tmux sessions (source of truth)
      const res = await fetch('/api/agents/running');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        this._agents = data.map(a => ({
          role: a.role,
          sessionName: a.sessionName,
          agentId: a.sessionName,
        }));
        this._renderAgents();
      }
    } catch { /* not authenticated or API unavailable */ }
  }
}

customElements.define('agent-grid', AgentGrid);
