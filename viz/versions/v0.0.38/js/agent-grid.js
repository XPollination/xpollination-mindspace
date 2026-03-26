/**
 * <agent-grid> — Responsive agent layout with Dashboard/Terminal view toggle
 * Dashboard: agent cards (chat-first, events, expandable terminal)
 * Terminal: full-size terminal grid (power user mode)
 */

class AgentGrid extends HTMLElement {
  connectedCallback() {
    this._view = 'dashboard'; // 'dashboard' or 'terminal'
    this._agents = [];

    this.innerHTML = `
      <div class="ag" style="display:flex;flex-direction:column;height:100%;">
        <div class="ag-toolbar" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--ms-surface,#f8fafc);border-bottom:1px solid var(--ms-border,#e2e8f0);">
          <span style="font-weight:bold;">Agent OS</span>
          <button class="ag-spawn" style="padding:4px 12px;border:none;border-radius:4px;background:var(--ms-accent,#ea580c);color:#fff;cursor:pointer;font-weight:bold;font-size:12px;">+ Start Agent</button>
          <div style="margin-left:auto;display:flex;gap:4px;">
            <button class="ag-view-dash" style="padding:3px 10px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;background:var(--ms-accent,#ea580c);color:#fff;cursor:pointer;font-size:11px;">Dashboard</button>
            <button class="ag-view-term" style="padding:3px 10px;border:1px solid var(--ms-border,#e2e8f0);border-radius:4px;background:none;color:var(--ms-text,#1e293b);cursor:pointer;font-size:11px;">Terminal</button>
          </div>
        </div>
        <div class="ag-grid" style="flex:1;display:grid;gap:8px;padding:8px;overflow:auto;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));">
          <div class="ag-empty" style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;color:var(--ms-muted,#94a3b8);font-size:14px;padding:40px;">
            No agents running. Click <strong style="margin:0 4px;">+ Start Agent</strong> to begin.
          </div>
        </div>
      </div>`;

    this._grid = this.querySelector('.ag-grid');
    this._empty = this.querySelector('.ag-empty');

    // View toggle
    this.querySelector('.ag-view-dash').addEventListener('click', () => this._setView('dashboard'));
    this.querySelector('.ag-view-term').addEventListener('click', () => this._setView('terminal'));

    // Spawn modal
    this.querySelector('.ag-spawn').addEventListener('click', () => this._spawnAgent());

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
      this._grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(500px,1fr))';
    }

    this._renderAgents();
  }

  _spawnAgent() {
    const role = prompt('Agent role (liaison / pdsa / dev / qa):', 'liaison');
    if (!role || !['liaison', 'pdsa', 'dev', 'qa'].includes(role)) return;

    const sessionName = `agent-${role}-${Date.now().toString(36)}`;
    this._agents.push({ role, sessionName, agentId: sessionName });
    this._renderAgents();
  }

  _renderAgents() {
    if (this._agents.length === 0) {
      this._empty.style.display = 'flex';
      return;
    }
    this._empty.style.display = 'none';

    // Remove existing agent elements (keep empty placeholder)
    this._grid.querySelectorAll('agent-card, agent-terminal').forEach(el => el.remove());

    for (const agent of this._agents) {
      if (this._view === 'dashboard') {
        const card = document.createElement('agent-card');
        card.setAttribute('agent-id', agent.agentId);
        card.setAttribute('role', agent.role);
        card.setAttribute('agent-name', `${agent.role}-agent`);
        card.setAttribute('session-name', agent.sessionName);
        this._grid.appendChild(card);
      } else {
        const term = document.createElement('agent-terminal');
        term.setAttribute('session-name', agent.sessionName);
        term.setAttribute('role', agent.role);
        term.style.height = '400px';
        this._grid.appendChild(term);
      }
    }
  }

  async _loadExistingAgents() {
    try {
      const res = await fetch('/api/agents?status=active');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        this._agents = data.map(a => ({
          role: a.current_role || 'dev',
          sessionName: `agent-${a.current_role || 'dev'}-${a.id.slice(0, 8)}`,
          agentId: a.id,
        }));
        this._renderAgents();
      }
    } catch { /* no agents API or not authenticated */ }
  }
}

customElements.define('agent-grid', AgentGrid);
