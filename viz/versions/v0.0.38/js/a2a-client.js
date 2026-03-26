/**
 * A2A Client — Browser-side Digital Twin communication
 *
 * The browser is a first-class A2A participant. It holds twins locally,
 * validates before submitting, and receives push updates via SSE.
 *
 * Usage:
 *   const client = new A2AClient();
 *   await client.connect('mindspace');
 *   const missions = await client.query('mission', { include_capabilities: true });
 */

export class A2AClient {
  constructor() {
    this._agentId = null;
    this._sessionId = null;
    this._projectSlug = null;
    this._eventSource = null;
    this._listeners = {};
    this._reconnectTimer = null;
    this._reconnectDelay = 5000;
    this._connected = false;
  }

  /** Connect to A2A server. JWT from ms_session cookie is sent automatically by the browser. */
  async connect(projectSlug) {
    this._projectSlug = projectSlug;

    const twin = {
      identity: {
        agent_name: 'browser-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now()),
        session_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      },
      role: {
        current: 'liaison',
        capabilities: ['view', 'confirm', 'rework'],
      },
      project: {
        slug: projectSlug,
        branch: 'main',
      },
      state: { status: 'active' },
      metadata: { framework: 'browser-a2a-client' },
    };

    const res = await fetch('/a2a/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(twin),
    });

    const data = await res.json();

    if (data.type === 'ERROR') {
      throw new Error(`A2A connect failed: ${data.error}`);
    }

    this._agentId = data.agent_id;
    this._sessionId = data.session_id;
    this._connected = true;

    // Open SSE stream for push updates
    this._openStream();

    this._emit('connected', {
      agent_id: this._agentId,
      session_id: this._sessionId,
      project: data.project,
    });

    return data;
  }

  /** Query knowledge objects via A2A OBJECT_QUERY */
  async query(objectType, filters = {}) {
    if (!this._agentId) throw new Error('Not connected. Call connect() first.');

    const res = await fetch('/a2a/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this._agentId,
        type: 'OBJECT_QUERY',
        object_type: objectType,
        filters: { project_slug: this._projectSlug, ...filters },
      }),
    });

    const data = await res.json();

    if (data.type === 'ERROR') {
      throw new Error(`OBJECT_QUERY failed: ${data.error}`);
    }

    return data.objects || [];
  }

  /** Send a task transition via A2A */
  async transition(taskSlug, toStatus, payload = {}) {
    if (!this._agentId) throw new Error('Not connected. Call connect() first.');

    const res = await fetch('/a2a/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this._agentId,
        type: 'TRANSITION',
        task_slug: taskSlug,
        to_status: toStatus,
        payload,
      }),
    });

    const data = await res.json();

    if (data.type === 'ERROR') {
      throw new Error(`TRANSITION failed: ${data.error}`);
    }

    this._emit('transition_ack', data);
    return data;
  }

  /** Send heartbeat */
  async heartbeat() {
    if (!this._agentId) return;

    try {
      await fetch('/a2a/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: this._agentId,
          type: 'HEARTBEAT',
        }),
      });
    } catch { /* silent */ }
  }

  /** Disconnect gracefully */
  async disconnect() {
    if (!this._agentId) return;

    try {
      await fetch('/a2a/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: this._agentId,
          type: 'DISCONNECT',
        }),
      });
    } catch { /* silent */ }

    this._cleanup();
  }

  /** Register event listener */
  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return this;
  }

  /** Remove event listener */
  off(event, handler) {
    if (!this._listeners[event]) return this;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    return this;
  }

  get connected() { return this._connected; }
  get agentId() { return this._agentId; }
  get sessionId() { return this._sessionId; }

  // --- Internal ---

  _openStream() {
    if (this._eventSource) {
      this._eventSource.close();
    }

    const url = `/a2a/stream/${this._agentId}`;
    this._eventSource = new EventSource(url);

    this._eventSource.addEventListener('connected', (e) => {
      this._connected = true;
      this._emit('stream_connected', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('transition', (e) => {
      this._emit('transition', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('object_data', (e) => {
      this._emit('object_data', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('task_available', (e) => {
      this._emit('task_available', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('object_create', (e) => {
      this._emit('object_create', JSON.parse(e.data));
    });

    this._eventSource.addEventListener('object_update', (e) => {
      this._emit('object_update', JSON.parse(e.data));
    });

    this._eventSource.onerror = () => {
      this._connected = false;
      this._emit('error', { message: 'SSE connection lost' });
      this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._connected && this._agentId) {
        this._openStream();
      }
    }, this._reconnectDelay);
  }

  _cleanup() {
    this._connected = false;
    if (this._eventSource) {
      this._eventSource.close();
      this._eventSource = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._agentId = null;
    this._sessionId = null;
  }

  _emit(event, data) {
    const handlers = this._listeners[event] || [];
    for (const h of handlers) {
      try { h(data); } catch (e) { console.error(`A2A event handler error (${event}):`, e); }
    }
  }
}
