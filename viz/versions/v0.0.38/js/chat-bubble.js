/**
 * <chat-bubble> — Floating Decision Interface on every Mindspace page
 * Bottom-right bubble with badge count of pending decisions.
 * Expand: decision cards + agent status + free text input.
 * Connects to A2A as a client — sends messages with agent identity.
 */

import { A2AClient } from './a2a-client.js';

class ChatBubble extends HTMLElement {
  connectedCallback() {
    this._client = new A2AClient();
    this._expanded = false;
    this._pendingCount = 0;
    this._decisions = [];
    this._messages = JSON.parse(sessionStorage.getItem('cb_messages') || '[]');

    this.innerHTML = `
      <style>
        .cb-bubble { position:fixed; bottom:20px; right:20px; z-index:9999; }
        .cb-btn { width:52px; height:52px; border-radius:50%; border:none; background:var(--ms-accent,#ea580c); color:#fff; cursor:pointer; font-size:20px; box-shadow:0 4px 12px rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; transition:transform 0.2s; }
        .cb-btn:hover { transform:scale(1.08); }
        .cb-badge { position:absolute; top:-4px; right:-4px; background:#ef4444; color:#fff; font-size:10px; font-weight:bold; border-radius:50%; min-width:18px; height:18px; display:none; align-items:center; justify-content:center; padding:0 4px; }
        .cb-panel { position:fixed; bottom:80px; right:20px; width:380px; max-height:500px; border-radius:12px; border:1px solid var(--ms-border,#e2e8f0); background:var(--ms-bg,#fff); box-shadow:0 8px 30px rgba(0,0,0,0.12); display:none; flex-direction:column; overflow:hidden; z-index:9998; }
        .cb-panel.open { display:flex; }
        .cb-header { padding:10px 14px; background:var(--ms-surface,#f8fafc); border-bottom:1px solid var(--ms-border,#e2e8f0); display:flex; align-items:center; gap:8px; }
        .cb-body { flex:1; overflow-y:auto; padding:8px; max-height:350px; }
        .cb-input { display:flex; border-top:1px solid var(--ms-border,#e2e8f0); }
        .cb-input input { flex:1; border:none; padding:10px 12px; font-size:13px; outline:none; }
        .cb-input button { border:none; background:var(--ms-accent,#ea580c); color:#fff; padding:10px 16px; cursor:pointer; }
        .cb-status { display:flex; gap:4px; align-items:center; }
        .cb-dot { width:6px; height:6px; border-radius:50%; }
      </style>
      <div class="cb-bubble">
        <button class="cb-btn" title="Decisions">
          💬
          <span class="cb-badge">0</span>
        </button>
      </div>
      <div class="cb-panel">
        <div class="cb-header">
          <strong style="font-size:13px;">Decision Interface</strong>
          <div class="cb-status" style="margin-left:auto;"></div>
        </div>
        <div class="cb-body">
          <div class="cb-decisions"></div>
          <div class="cb-messages" style="margin-top:8px;"></div>
        </div>
        <div class="cb-input">
          <input type="text" placeholder="Type a message to LIAISON..." />
          <button>Send</button>
        </div>
      </div>`;

    this._badge = this.querySelector('.cb-badge');
    this._panel = this.querySelector('.cb-panel');
    this._decisionsEl = this.querySelector('.cb-decisions');
    this._messagesEl = this.querySelector('.cb-messages');
    // Restore persisted messages from previous page
    this._messages.forEach(msg => {
      const div = document.createElement("div");
      div.style.cssText = "padding:4px 0;font-size:12px;border-bottom:1px solid var(--ms-border,#f1f5f9);";
      div.innerHTML = `<span style="color:${msg.color || "#94a3b8"};font-weight:bold;font-size:10px;">${msg.from}</span> <span>${msg.text}</span>`;
      this._messagesEl.appendChild(div);
    });

    // Restore persisted messages from previous page
    this._restoreMessages();

    // Toggle panel
    this.querySelector('.cb-btn').addEventListener('click', () => {
      this._expanded = !this._expanded;
      this._panel.classList.toggle('open', this._expanded);
      if (this._expanded) this._loadPendingDecisions();
    });

    // Send message
    const input = this.querySelector('.cb-input input');
    const sendBtn = this.querySelector('.cb-input button');
    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      this._sendHumanInput(text);
      this._addMessage('You', text);
      input.value = '';
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    // Connect as A2A client then listen for events
    this._connectA2A();

    // Listen for decision-resolve from child decision-cards
    this.addEventListener('decision-resolve', (e) => {
      this._resolveDecision(e.detail);
    });
  }

  async _connectA2A() {
    try {
      const projectSlug = document.querySelector('[data-project-slug]')?.dataset.projectSlug || 'xpollination-mindspace';
      await this._client.connect(projectSlug);

      // Auto-start LIAISON if not running
      this._ensureLiaison();

      this._client.on('decision_needed', (data) => {
        this._decisions.push(data);
        this._pendingCount++;
        this._updateBadge();
        if (this._expanded) this._renderDecision(data);
      });

      this._client.on('decision_resolved', () => {
        this._pendingCount = Math.max(0, this._pendingCount - 1);
        this._updateBadge();
      });

      this._client.on('human_input', (data) => {
        if (data.from !== 'You') {
          this._addMessage(data.from || 'Agent', data.text);
        }
      });

      this._client.on('transition', (data) => {
        this._addMessage('System', `${data.task_slug} → ${data.to_status}`, '#94a3b8');
      });
    } catch (err) {
      console.warn('[chat-bubble] A2A connect failed:', err.message);
      // Fallback: use raw SSE with special liaison-chat ID
      this._es = new EventSource('/a2a/stream/liaison-chat');
      this._es.addEventListener('decision_needed', (e) => {
        const data = JSON.parse(e.data);
        this._decisions.push(data);
        this._pendingCount++;
        this._updateBadge();
        if (this._expanded) this._renderDecision(data);
      });
    }
  }

  _updateBadge() {
    this._badge.textContent = this._pendingCount;
    this._badge.style.display = this._pendingCount > 0 ? 'flex' : 'none';
  }

  async _loadPendingDecisions() {
    try {
      const data = await this._client.query('decision', { status: 'pending' });
      const decisions = data?.results || data?.data || [];
      this._decisionsEl.innerHTML = '';
      decisions.forEach(d => this._renderDecision(d));
      this._pendingCount = decisions.length;
      this._updateBadge();
    } catch { /* ignore — decisions table may not have data yet */ }
  }

  _renderDecision(dec) {
    const card = document.createElement('decision-card');
    card.decision = dec;
    this._decisionsEl.appendChild(card);
  }

  async _resolveDecision({ decisionId, choice, reasoning }) {
    try {
      await this._client.send('DECISION_RESPONSE', { decision_id: decisionId, choice, reasoning, human_prompt: `Chose ${choice}: ${reasoning}` });
      this._addMessage('You', `Decision: chose ${choice}${reasoning ? ` — ${reasoning}` : ''}`, '#22c55e');
    } catch (err) {
      this._addMessage('Error', err.message, '#ef4444');
    }
  }

  async _sendHumanInput(text) {
    try {
      const liaisonId = sessionStorage.getItem('cb_liaison_agent_id');
      await this._client.send('HUMAN_INPUT', { text, target_agent_id: liaisonId || undefined });
    } catch { /* ignore */ }
  }

  async _ensureLiaison() {
    try {
      const res = await fetch('/api/agents/me/liaison');
      const data = await res.json();
      if (data.running) {
        sessionStorage.setItem('cb_liaison_session', data.sessionName);
        sessionStorage.setItem('cb_liaison_agent_id', data.agentId || data.sessionName);
        return;
      }
      // Not running — auto-start
      this._addMessage('System', 'Starting LIAISON...', '#94a3b8');
      const start = await fetch('/api/agents/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'liaison' }),
      });
      const agent = await start.json();
      if (start.ok) {
        sessionStorage.setItem('cb_liaison_session', agent.sessionName);
        sessionStorage.setItem('cb_liaison_agent_id', agent.agentId || agent.sessionName);
        this._addMessage('System', `LIAISON ${agent.status}. Open Agents page to complete setup.`, '#22c55e');
      }
    } catch { /* ignore — LIAISON check is best-effort */ }
  }

  _addMessage(from, text, color) {
    const c = color || (from === 'You' ? '#3b82f6' : '#f59e0b');
    // Persist to sessionStorage (survives page navigation)
    this._messages.push({ from, text, color: c, time: Date.now() });
    // Keep last 50 messages
    if (this._messages.length > 50) this._messages = this._messages.slice(-50);
    sessionStorage.setItem('cb_messages', JSON.stringify(this._messages));
    this._renderMessage(from, text, c);
  }

  _renderMessage(from, text, color) {
    const div = document.createElement('div');
    div.style.cssText = `padding:4px 0;font-size:12px;border-bottom:1px solid var(--ms-border,#f1f5f9);`;
    div.innerHTML = `<span style="color:${color};font-weight:bold;font-size:10px;">${from}</span> <span>${text}</span>`;
    this._messagesEl.appendChild(div);
    this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
  }

  _restoreMessages() {
    for (const msg of this._messages) {
      this._renderMessage(msg.from, msg.text, msg.color);
    }
  }

  disconnectedCallback() {
    if (this._client) this._client.disconnect();
    if (this._es) this._es.close();
  }
}

customElements.define('chat-bubble', ChatBubble);
