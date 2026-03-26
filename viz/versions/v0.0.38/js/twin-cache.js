/**
 * Twin Cache — Local in-memory store for Digital Twins
 *
 * The browser holds twins here after receiving them via A2A.
 * Twins are keyed by (type, id). Updates come from SSE push.
 */

export class TwinCache {
  constructor() {
    this._store = new Map(); // key: "type:id" → twin object
    this._listeners = [];
  }

  /** Store a twin. Stamps _fetched_at for staleness detection. */
  set(type, id, twin) {
    const key = `${type}:${id}`;
    const stamped = { ...twin, _fetched_at: new Date().toISOString() };
    this._store.set(key, stamped);
    this._notify('set', type, id, stamped);
    return stamped;
  }

  /** Get a single twin by type and id. */
  get(type, id) {
    return this._store.get(`${type}:${id}`) || null;
  }

  /** Get all twins of a given type. */
  getAll(type) {
    const prefix = `${type}:`;
    const results = [];
    for (const [key, twin] of this._store) {
      if (key.startsWith(prefix)) results.push(twin);
    }
    return results;
  }

  /** Filter twins of a given type. */
  filter(type, fn) {
    return this.getAll(type).filter(fn);
  }

  /** Bulk load twins from an OBJECT_DATA response. */
  loadAll(type, twins) {
    const loaded = [];
    for (const twin of twins) {
      const id = twin.id || twin.slug || twin.short_id;
      if (id) loaded.push(this.set(type, id, twin));
    }
    return loaded;
  }

  /** Remove a twin. */
  remove(type, id) {
    const key = `${type}:${id}`;
    const existed = this._store.delete(key);
    if (existed) this._notify('remove', type, id, null);
    return existed;
  }

  /** Clear all twins of a type, or all twins. */
  clear(type) {
    if (type) {
      const prefix = `${type}:`;
      for (const key of [...this._store.keys()]) {
        if (key.startsWith(prefix)) this._store.delete(key);
      }
    } else {
      this._store.clear();
    }
    this._notify('clear', type, null, null);
  }

  /** Get count of twins by type. */
  count(type) {
    if (!type) return this._store.size;
    return this.getAll(type).length;
  }

  /** Listen for cache changes. Handler receives (event, type, id, twin). */
  onChange(handler) {
    this._listeners.push(handler);
    return () => {
      this._listeners = this._listeners.filter(h => h !== handler);
    };
  }

  _notify(event, type, id, twin) {
    for (const h of this._listeners) {
      try { h(event, type, id, twin); } catch { /* silent */ }
    }
  }
}
