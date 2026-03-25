/**
 * Liaison Chat — human-in-the-loop interface replacing tmux send-keys
 * Web component: <liaison-chat project-slug="...">
 */
class LiaisonChat extends HTMLElement {
  constructor() { super(); this._eventSource = null; this._approvalMode = 'semi'; }

  connectedCallback() {
    this.innerHTML = `
      <div class="lc" style="display:flex;flex-direction:column;height:100%;background:#1e1e2e;color:#cdd6f4;font-family:sans-serif;border:1px solid #45475a;border-radius:6px;overflow:hidden;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#313244;border-bottom:1px solid #45475a;">
          <span style="font-weight:bold;">Liaison Chat</span>
          <span class="lc-mode" style="font-size:11px;padding:2px 8px;border-radius:3px;background:#45475a;margin-left:auto;"></span>
        </div>
        <div class="lc-messages" style="flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;"></div>
        <div class="lc-cards" style="padding:0 10px;"></div>
        <div style="display:flex;border-top:1px solid #45475a;">
          <input type="text" class="lc-text" placeholder="Type a message..." style="flex:1;background:#181825;border:none;color:#cdd6f4;padding:8px 12px;font-size:13px;outline:none;" />
          <button class="lc-send" style="background:#45475a;border:none;color:#cdd6f4;padding:8px 16px;cursor:pointer;">Send</button>
        </div>
      </div>`;
    this.querySelector('.lc-send').addEventListener('click', () => this._send());
    this.querySelector('.lc-text').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._send(); });
    this._loadMode();
    this._connectSSE();
  }

  disconnectedCallback() { if (this._eventSource) this._eventSource.close(); }

  async _loadMode() {
    try { const r = await fetch('/api/settings/liaison-approval-mode'); const d = await r.json(); this._approvalMode = d.mode || 'semi'; } catch {}
    this.querySelector('.lc-mode').textContent = `Mode: ${this._approvalMode}`;
  }

  _connectSSE() {
    this._eventSource = new EventSource(`${location.origin}/a2a/stream/liaison-chat`);
    this._eventSource.addEventListener('approval_needed', (e) => { const d = JSON.parse(e.data); this._showCard(d); this._msg('sys', `Approval needed: ${d.title || d.task_slug}`); });
    this._eventSource.addEventListener('review_needed', (e) => { const d = JSON.parse(e.data); this._msg('sys', `Review needed: ${d.title || d.task_slug}`); });
    this._eventSource.addEventListener('task_blocked', (e) => { const d = JSON.parse(e.data); this._msg('sys', `Blocked: ${d.task_slug} - ${d.blocked_reason}`); });
    this._eventSource.addEventListener('transition', (e) => { const d = JSON.parse(e.data); this._msg('sys', `${d.task_slug}: ${d.from_status} -> ${d.to_status}`); });
    this._eventSource.addEventListener('connected', () => this._msg('sys', 'Connected'));
  }

  _msg(sender, text) {
    const el = this.querySelector('.lc-messages'); if (!el) return;
    const d = document.createElement('div');
    d.style.cssText = `max-width:75%;padding:6px 10px;border-radius:8px;font-size:13px;align-self:${sender === 'user' ? 'flex-end' : 'flex-start'};background:${sender === 'user' ? '#1e66f5' : '#313244'};`;
    d.textContent = text; el.appendChild(d); el.scrollTop = el.scrollHeight;
  }

  _showCard(data) {
    const cards = this.querySelector('.lc-cards'); if (!cards) return;
    const card = document.createElement('div');
    card.style.cssText = 'background:#313244;border:1px solid #45475a;border-radius:8px;padding:12px;margin:8px 0;';
    const sum = data.proposed_design ? (typeof data.proposed_design === 'string' ? data.proposed_design : data.proposed_design.summary || '') : '';
    card.innerHTML = `<div style="font-weight:bold;margin-bottom:6px;">${data.title || data.task_slug}</div>
      ${sum ? `<div style="font-size:12px;color:#a6adc8;margin-bottom:8px;">${sum}</div>` : ''}
      <div style="display:flex;gap:8px;">
        <button class="lc-a" style="padding:6px 16px;border:none;border-radius:4px;background:#50fa7b;color:#1e1e2e;cursor:pointer;font-weight:bold;">Approve</button>
        <button class="lc-r" style="padding:6px 16px;border:none;border-radius:4px;background:#f38ba8;color:#1e1e2e;cursor:pointer;font-weight:bold;">Reject</button>
      </div>`;
    card.querySelector('.lc-a').addEventListener('click', () => { this._transition(data.task_slug, 'approved'); card.remove(); });
    card.querySelector('.lc-r').addEventListener('click', () => { const r = prompt('Reason:'); if (r) { this._transition(data.task_slug, 'rework', r); card.remove(); } });
    cards.appendChild(card);
    if (this._approvalMode === 'autonomous') setTimeout(() => { this._transition(data.task_slug, 'approved'); card.remove(); }, 5000);
  }

  async _transition(slug, to, reason) {
    const now = new Date().toISOString();
    const p = { human_answer: to === 'approved' ? 'Approve' : `Rework: ${reason}`, human_answer_at: now, approval_mode: this._approvalMode };
    if (reason) { p.rework_reason = reason; p.rework_target_role = 'dev'; }
    try {
      await fetch('/a2a/message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TRANSITION', agent_id: 'liaison-chat', task_slug: slug, to_status: to, payload: p }) });
      this._msg('user', `${slug} -> ${to}`);
    } catch (e) { this._msg('sys', `Error: ${e.message}`); }
  }

  async _send() {
    const input = this.querySelector('.lc-text'); const text = input.value.trim(); if (!text) return; input.value = '';
    this._msg('user', text);
    const m = text.match(/^@(\w+)\s+(.*)/);
    try { await fetch('/a2a/message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'HUMAN_INPUT', agent_id: m ? m[1] : 'liaison-chat', payload: { text: m ? m[2] : text } }) }); } catch {}
  }
}
customElements.define('liaison-chat', LiaisonChat);
