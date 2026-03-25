/**
 * Layout Manager — CSS Grid panel layout with presets, drag handles, persistence
 * No external dependencies. Pure CSS Grid + vanilla JS.
 */

const PRESETS = {
  single: { name: 'Single', cols: '1fr', rows: '1fr', slots: 1 },
  dual: { name: 'Dual', cols: '1fr 1fr', rows: '1fr', slots: 2 },
  triple: { name: 'Triple', cols: '1fr 1fr', rows: '1fr 1fr', slots: 3, areas: '"a b" "a c"' },
  quad: { name: 'Quad', cols: '1fr 1fr', rows: '1fr 1fr', slots: 4 },
  focus: { name: 'Focus', cols: '4fr 1fr', rows: '1fr', slots: 2 },
};

class LayoutManager {
  constructor(containerId, options = {}) {
    this._container = document.getElementById(containerId);
    if (!this._container) throw new Error(`Container #${containerId} not found`);
    this._panels = [];
    this._preset = options.preset || 'single';
    this._projectSlug = options.projectSlug || '';
    this._onSpawn = options.onSpawn || null;

    this._container.style.display = 'grid';
    this._container.style.gap = '4px';
    this._container.style.height = '100%';
    this._container.style.padding = '4px';

    this._applyPreset(this._preset);
    this._loadPersistedLayout();
    this._renderToolbar();
  }

  _applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;
    this._preset = presetName;
    this._container.style.gridTemplateColumns = preset.cols;
    this._container.style.gridTemplateRows = preset.rows;
    if (preset.areas) this._container.style.gridTemplateAreas = preset.areas;
    else this._container.style.gridTemplateAreas = '';
  }

  _renderToolbar() {
    let toolbar = document.getElementById('layout-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'layout-toolbar';
      toolbar.style.cssText = 'display:flex;gap:6px;padding:6px 10px;background:#181825;border-bottom:1px solid #45475a;align-items:center;';
      this._container.parentElement?.insertBefore(toolbar, this._container);
    }
    toolbar.innerHTML = '';

    // Preset buttons
    for (const [key, preset] of Object.entries(PRESETS)) {
      const btn = document.createElement('button');
      btn.textContent = preset.name;
      btn.style.cssText = `padding:4px 10px;border:1px solid #45475a;border-radius:4px;background:${key === this._preset ? '#45475a' : '#313244'};color:#cdd6f4;cursor:pointer;font-size:12px;`;
      btn.addEventListener('click', () => {
        this._applyPreset(key);
        this._renderToolbar();
        this._persistLayout();
      });
      toolbar.appendChild(btn);
    }

    // Add Agent button
    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Agent';
    addBtn.style.cssText = 'padding:4px 10px;border:1px solid #50fa7b;border-radius:4px;background:#313244;color:#50fa7b;cursor:pointer;font-size:12px;margin-left:auto;';
    addBtn.addEventListener('click', () => this._showSpawnDialog());
    toolbar.appendChild(addBtn);
  }

  async addPanel(agentId, role, agentName) {
    const panel = document.createElement('agent-panel');
    panel.setAttribute('agent-id', agentId);
    panel.setAttribute('role', role);
    panel.setAttribute('agent-name', agentName || `${role}-agent`);

    // Grid area for triple layout
    if (this._preset === 'triple' && this._panels.length < 3) {
      panel.style.gridArea = ['a', 'b', 'c'][this._panels.length];
    }

    panel.addEventListener('fullscreen-toggle', (e) => this._handleFullscreen(e.detail.agentId));

    this._container.appendChild(panel);
    this._panels.push({ agent_id: agentId, role, element: panel });
    this._persistLayout();
  }

  removePanel(agentId) {
    const idx = this._panels.findIndex(p => p.agent_id === agentId);
    if (idx === -1) return;
    const panel = this._panels[idx];
    panel.element.remove();
    this._panels.splice(idx, 1);
    this._persistLayout();
  }

  _handleFullscreen(agentId) {
    const panel = this._panels.find(p => p.agent_id === agentId);
    if (!panel) return;
    const isFullscreen = panel.element.classList.contains('fullscreen');
    if (isFullscreen) {
      panel.element.style.cssText = '';
      panel.element.style.position = 'fixed';
      panel.element.style.inset = '0';
      panel.element.style.zIndex = '1000';
      panel.element.style.margin = '0';
    } else {
      panel.element.style.cssText = '';
    }
  }

  _showSpawnDialog() {
    const roles = ['pdsa', 'dev', 'qa', 'liaison'];
    const role = prompt(`Select role: ${roles.join(', ')}`);
    if (!role || !roles.includes(role)) return;
    if (this._onSpawn) this._onSpawn(role, this._projectSlug);
  }

  async _persistLayout() {
    const config = {
      preset: this._preset,
      panels: this._panels.map(p => ({ agent_id: p.agent_id, role: p.role })),
    };
    try {
      const key = `layout_${this._projectSlug}`;
      localStorage.setItem(key, JSON.stringify(config));
    } catch { /* ignore */ }
  }

  _loadPersistedLayout() {
    try {
      const key = `layout_${this._projectSlug}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const config = JSON.parse(saved);
        if (config.preset && PRESETS[config.preset]) {
          this._applyPreset(config.preset);
        }
      }
    } catch { /* ignore */ }
  }
}

window.LayoutManager = LayoutManager;
