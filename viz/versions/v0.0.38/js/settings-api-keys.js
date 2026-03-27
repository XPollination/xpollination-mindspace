/**
 * Settings: API Key Management — guided 3-step flow with validation
 */
const PROVIDER_LINKS = {
  anthropic: { text: 'Get your API key at', url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console', prefix: 'sk-ant-' },
  openai: { text: 'Get your API key at', url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform', prefix: 'sk-' },
  custom: { text: 'Enter your API key below', url: '', label: '', prefix: '' },
};

class SettingsApiKeys extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div style="padding:16px;"><h3 style="margin:0 0 12px;">API Keys</h3><div class="ak-content"></div></div>`;
    this._loadKeys();
  }

  async _loadKeys() {
    const content = this.querySelector('.ak-content');
    let keys = [];
    try { const res = await fetch('/api/settings/api-keys'); keys = await res.json(); } catch {}

    const hasAnthropicKey = keys.some(k => k.provider === 'anthropic' && k.status === 'active');

    if (hasAnthropicKey) {
      // Connected state — show key info + option to replace
      const key = keys.find(k => k.provider === 'anthropic' && k.status === 'active');
      content.innerHTML = `
        <div style="background:#313244;border:1px solid #50fa7b;border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="color:#50fa7b;font-size:18px;">●</span>
            <span style="font-weight:bold;color:#50fa7b;">Connected</span>
            <span style="color:#6c7086;font-size:12px;margin-left:auto;">Anthropic Claude</span>
          </div>
          <div style="font-family:monospace;font-size:13px;color:#a6adc8;">sk-ant-...${key.key_name || ''}</div>
          <div style="font-size:11px;color:#6c7086;margin-top:4px;">Added ${key.created_at?.split('T')[0] || ''}${key.last_used_at ? ' · Last used ' + key.last_used_at.split('T')[0] : ''}</div>
          <button class="ak-revoke" data-id="${key.id}" style="margin-top:8px;padding:4px 12px;border:1px solid #f38ba8;border-radius:4px;background:none;color:#f38ba8;cursor:pointer;font-size:11px;">Remove Key</button>
        </div>
        ${this._renderOtherKeys(keys.filter(k => k !== key))}`;
      content.querySelector('.ak-revoke')?.addEventListener('click', () => this._revokeKey(key.id));
    } else {
      // Setup flow — guided 3 steps
      content.innerHTML = `
        <div style="background:#313244;border:1px solid #45475a;border-radius:8px;padding:16px;">
          <div style="font-weight:bold;margin-bottom:12px;">Set up Anthropic API Key</div>
          <div style="margin-bottom:12px;">
            <span style="background:#45475a;color:#cdd6f4;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:6px;">Step 1</span>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:#89b4fa;">Open Anthropic Console ↗</a>
            <span style="color:#6c7086;font-size:12px;"> — create an API key there</span>
          </div>
          <div style="margin-bottom:12px;">
            <span style="background:#45475a;color:#cdd6f4;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:6px;">Step 2</span>
            <span style="font-size:13px;">Paste your key below</span>
          </div>
          <input type="password" class="ak-key" placeholder="sk-ant-..." style="width:100%;padding:8px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;font-family:monospace;margin-bottom:8px;box-sizing:border-box;" />
          <div class="ak-error" style="color:#f38ba8;font-size:12px;margin-bottom:8px;display:none;"></div>
          <div>
            <span style="background:#45475a;color:#cdd6f4;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:6px;">Step 3</span>
            <button class="ak-validate" style="padding:6px 20px;border:none;border-radius:4px;background:#50fa7b;color:#1e1e2e;cursor:pointer;font-weight:bold;">Validate & Save</button>
          </div>
        </div>
        ${this._renderOtherKeys(keys)}
        <div style="margin-top:12px;">
          <details style="font-size:12px;color:#6c7086;">
            <summary style="cursor:pointer;">Add key for another provider</summary>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:flex-end;">
              <select class="ak-provider" style="padding:6px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;">
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
              <input type="password" class="ak-other-key" placeholder="API key" style="flex:1;padding:6px;border:1px solid #45475a;border-radius:4px;background:#181825;color:#cdd6f4;" />
              <button class="ak-add-other" style="padding:6px 12px;border:none;border-radius:4px;background:#45475a;color:#cdd6f4;cursor:pointer;">Add</button>
            </div>
            <p style="margin:4px 0 0;font-size:11px;">Get your API key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style="color:#89b4fa;">OpenAI Platform ↗</a></p>
          </details>
        </div>`;
      content.querySelector('.ak-validate')?.addEventListener('click', () => this._validateAndSave());
      content.querySelector('.ak-add-other')?.addEventListener('click', () => this._addOtherKey());
    }
    content.querySelectorAll('.ak-revoke-other').forEach(btn => btn.addEventListener('click', () => this._revokeKey(btn.dataset.id)));
  }

  _renderOtherKeys(keys) {
    const other = keys.filter(k => k.status === 'active');
    if (!other.length) return '';
    return '<div style="margin-top:12px;font-size:12px;">' + other.map(k =>
      `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #313244;">
        <span>${k.provider}</span><span style="color:#6c7086;">${k.key_name || ''}</span>
        <button class="ak-revoke-other" data-id="${k.id}" style="margin-left:auto;padding:2px 8px;border:1px solid #f38ba8;border-radius:3px;background:none;color:#f38ba8;cursor:pointer;font-size:11px;">Remove</button>
      </div>`
    ).join('') + '</div>';
  }

  async _validateAndSave() {
    const key = this.querySelector('.ak-key').value.trim();
    const errEl = this.querySelector('.ak-error');
    if (!key) { errEl.textContent = 'Please paste your API key'; errEl.style.display = 'block'; return; }
    if (!key.startsWith('sk-ant-')) { errEl.textContent = 'Anthropic keys start with sk-ant-'; errEl.style.display = 'block'; return; }
    errEl.style.display = 'none';

    const btn = this.querySelector('.ak-validate');
    btn.textContent = 'Validating...'; btn.disabled = true;

    try {
      const res = await fetch('/api/settings/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'anthropic', key, name: 'Claude API Key' }) });
      if (!res.ok) { const d = await res.json(); errEl.textContent = d.error || 'Save failed'; errEl.style.display = 'block'; btn.textContent = 'Validate & Save'; btn.disabled = false; return; }
      this._loadKeys(); // Refresh to connected state
    } catch { errEl.textContent = 'Network error'; errEl.style.display = 'block'; btn.textContent = 'Validate & Save'; btn.disabled = false; }
  }

  async _addOtherKey() {
    const provider = this.querySelector('.ak-provider').value;
    const key = this.querySelector('.ak-other-key').value.trim();
    if (!key) return;
    try { await fetch('/api/settings/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }) }); this._loadKeys(); } catch {}
  }

  async _revokeKey(id) {
    try { await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' }); this._loadKeys(); } catch {}
  }
}
customElements.define('settings-api-keys', SettingsApiKeys);
