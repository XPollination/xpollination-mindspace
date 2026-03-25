/**
 * Settings: API Key Management
 * Renders in the /settings page API Keys tab
 */
class SettingsApiKeys extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="padding:16px;">
        <h3 style="margin:0 0 12px;">API Keys</h3>
        <div class="ak-list" style="margin-bottom:16px;"></div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;">Provider
            <select class="ak-provider" style="padding:6px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;">
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;flex:1;">Key
            <input type="password" class="ak-key" placeholder="sk-..." style="padding:6px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;" />
          </label>
          <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;">Name
            <input type="text" class="ak-name" placeholder="Label" style="padding:6px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;width:120px;" />
          </label>
          <button class="ak-add" style="padding:6px 16px;border:none;border-radius:4px;background:#50fa7b;color:#1e1e2e;cursor:pointer;font-weight:bold;height:32px;">Add</button>
        </div>
      </div>`;
    this.querySelector('.ak-add').addEventListener('click', () => this._addKey());
    this._loadKeys();
  }

  async _loadKeys() {
    const list = this.querySelector('.ak-list');
    try {
      const res = await fetch('/api/settings/api-keys');
      const keys = await res.json();
      if (!keys.length) { list.innerHTML = '<div style="color:#6c7086;font-size:13px;">No API keys configured</div>'; return; }
      list.innerHTML = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
        '<tr style="border-bottom:1px solid #45475a;"><th style="text-align:left;padding:4px;">Provider</th><th>Name</th><th>Created</th><th>Last Used</th><th>Status</th><th></th></tr>' +
        keys.map(k => `<tr style="border-bottom:1px solid #313244;">
          <td style="padding:4px;">${k.provider}</td><td>${k.key_name || '-'}</td>
          <td>${k.created_at?.split('T')[0] || '-'}</td><td>${k.last_used_at?.split('T')[0] || 'never'}</td>
          <td>${k.status}</td>
          <td>${k.status === 'active' ? `<button data-id="${k.id}" class="ak-revoke" style="padding:2px 8px;border:1px solid #f38ba8;border-radius:3px;background:none;color:#f38ba8;cursor:pointer;font-size:11px;">Revoke</button>` : ''}</td>
        </tr>`).join('') + '</table>';
      list.querySelectorAll('.ak-revoke').forEach(btn => btn.addEventListener('click', () => this._revokeKey(btn.dataset.id)));
    } catch { list.innerHTML = '<div style="color:#f38ba8;">Failed to load keys</div>'; }
  }

  async _addKey() {
    const provider = this.querySelector('.ak-provider').value;
    const key = this.querySelector('.ak-key').value.trim();
    const name = this.querySelector('.ak-name').value.trim();
    if (!key) return;
    try {
      await fetch('/api/settings/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key, name: name || undefined }) });
      this.querySelector('.ak-key').value = '';
      this.querySelector('.ak-name').value = '';
      this._loadKeys();
    } catch { /* ignore */ }
  }

  async _revokeKey(id) {
    try { await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' }); this._loadKeys(); } catch {}
  }
}
customElements.define('settings-api-keys', SettingsApiKeys);
