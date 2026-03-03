# PDSA: viz-approval-mode-resets v0.0.1

**Date:** 2026-03-03
**Author:** PDSA Agent
**Task:** Bug: Liaison approval mode resets to manual without user action
**Status:** Design

---

## PLAN

### Problem Statement

Thomas set `liaison-approval-mode` from `manual` to `semi` via the viz UI dropdown. Later, it was found reverted to `manual`. The API reports `updated_by: thomas, updated_at: 2026-03-03 17:18:18` — but Thomas did not make this change. All 4 project DBs (HomePage, best-practices, hive, mcp-server) show identical `manual` with the same timestamp, confirming the PUT handler ran and synced correctly.

### Investigation Findings

**The exact trigger is unknown** because the system has zero observability:
- No server-side request logging
- `updated_by` is hardcoded to `'thomas'` in the PUT handler (line 322 of server.js) — making it impossible to distinguish human action from programmatic trigger
- No audit trail for settings changes

**Structural weaknesses that enable silent mode resets:**

1. **Hardcoded `updated_by: 'thomas'`** (server.js:322) — the PUT handler always writes `updated_by='thomas'`, regardless of who/what triggered the call. This is the primary observability blocker.

2. **No request logging** — the viz server has no access log. No way to correlate the 17:18:18 PUT with a client action.

3. **The dropdown `change` handler fires PUT immediately** (index.html:686-695) — no confirmation, no debounce. If the `change` event fires for ANY reason (accidental click, browser quirk, stale tab), the mode is silently overwritten.

4. **HTML default is `manual`** (index.html:557) — `<option value="manual">Manual</option>` is the first option. On full page load, before `loadLiaisonMode()` async fetch completes, the dropdown shows `Manual`. While programmatic `.value` changes don't normally fire `change` events, this creates a window for interaction.

5. **Settings replicated across 4 DBs** — the PUT writes to all discovered project DBs, GET reads from `projects[0]`. While the sync works (all 4 show identical data), replication adds complexity and failure modes.

6. **`getSettingsDb()` re-seeds `manual` default every access** (server.js:186) — `INSERT OR IGNORE` is safe for existing rows, but if the row is ever deleted (schema migration, manual cleanup), it silently re-inserts `manual` without trace.

7. **Prior bug context** (brain thought 1bd97e94): On 2026-03-02, LIAISON fixed a bug where PUT only wrote to `projects[0]` (HomePage). Fix: iterate ALL discovered project DBs. The fix works — but the underlying architectural issue (replicated settings) remains.

### Most Likely Root Cause

The PUT endpoint was called with `mode=manual` by the browser's dropdown `change` handler. Possible triggers:
- Stale browser tab with dropdown at `manual` default → user interaction or browser event fires `change`
- Page reload where `loadLiaisonMode()` briefly fails → dropdown stays at `manual` → accidental interaction
- Multiple viz tabs open → mode changed in Tab A, stale Tab B still shows `manual` → Tab B triggers PUT

Without request logging, the exact trigger cannot be confirmed retroactively.

### Acceptance Criteria (from DNA)

1. Approval mode persists across viz page refreshes
2. Approval mode persists across viz server restarts
3. No script or process resets the mode without explicit user action
4. Mode change is logged with accurate actor (not falsely attributed to thomas)
5. Mode survives pm-status.cjs scans and other read operations

---

## DO — Design

### Sub-Problem 1: Audit Trail for Mode Changes (server.js)

**What:** Add a `system_settings_audit` table that logs every mode change with timestamp, old value, new value, and source.

**Schema addition in `getSettingsDb()` or separate init:**

```sql
CREATE TABLE IF NOT EXISTS system_settings_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**PUT handler changes (server.js:318-327):**

```javascript
// Read old value before writing
const oldRow = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
const oldValue = oldRow?.value || 'manual';

// Write new value with actual source
const source = body.source || 'viz-ui';
db.prepare("INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at) VALUES ('liaison_approval_mode', ?, ?, datetime('now'))").run(body.mode, source);

// Audit log
db.prepare("INSERT INTO system_settings_audit (key, old_value, new_value, changed_by, source) VALUES ('liaison_approval_mode', ?, ?, ?, ?)").run(oldValue, body.mode, source, source);
```

### Sub-Problem 2: Fix `updated_by` to Reflect Actual Source (server.js)

**What:** Replace hardcoded `'thomas'` with the `source` from the PUT body.

**Current (line 322):**
```javascript
... VALUES ('liaison_approval_mode', ?, 'thomas', datetime('now'))
```

**Fix:**
```javascript
const source = body.source || 'viz-ui';
... VALUES ('liaison_approval_mode', ?, ?, datetime('now')), body.mode, source
```

**Client-side change handler (index.html:686-695):** Include `source: 'viz-dropdown'` in PUT body.

### Sub-Problem 3: Request Logging for Mode Changes (server.js)

**What:** Add a `console.error` (stderr) log line when the PUT handler runs, including timestamp, old value, new value, and source. This provides immediate visibility without an audit table.

```javascript
console.error(`[${new Date().toISOString()}] liaison-approval-mode: ${oldValue} → ${body.mode} (source: ${source})`);
```

### Sub-Problem 4: Protect Against Accidental Writes (index.html)

**What:** Add a no-op guard in the `change` handler: if the new value equals the current server value, skip the PUT.

```javascript
liaisonModeSelect.addEventListener('change', async () => {
  if (suppressModeChange) return;
  const newMode = liaisonModeSelect.value;
  // Skip if no actual change (prevents phantom writes from page reload)
  if (newMode === liaisonModeSelect.dataset.serverMode) return;
  try {
    const res = await fetch('/api/settings/liaison-approval-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode, source: 'viz-dropdown' })
    });
    if (res.ok) {
      liaisonModeSelect.dataset.serverMode = newMode;
    }
  } catch (e) { /* ignore */ }
});
```

And in `loadLiaisonMode()`, store the server value:
```javascript
liaisonModeSelect.dataset.serverMode = data.mode;
```

This ensures the `change` handler only fires a PUT when the value ACTUALLY differs from what the server has.

### Sub-Problem 5: Update Version Symlink Copies

**What:** After dev implements, copy changes to `viz/versions/v0.0.1/`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `viz/server.js` | Fix `updated_by` from hardcoded `'thomas'` to actual source; add audit table; add stderr logging; create audit table in `getSettingsDb()` |
| `viz/index.html` | Change handler: include `source` in PUT body; add `dataset.serverMode` guard against phantom writes |
| `viz/versions/v0.0.1/server.js` | Mirror root changes |
| `viz/versions/v0.0.1/index.html` | Mirror root changes |

---

## STUDY — Verification Plan

| AC | How to verify |
|----|---------------|
| 1. Mode persists across page refreshes | Set mode to `semi` → refresh page → dropdown shows `semi` |
| 2. Mode persists across server restarts | Set mode to `semi` → restart viz server → GET returns `semi` |
| 3. No script resets mode | Check audit table after agent operations → no unexpected writes |
| 4. Mode change logged with accurate actor | Set mode via viz → audit table shows `viz-dropdown`; set via curl → shows `curl-test` |
| 5. Mode survives read operations | Run `pm-status.cjs` and `agent-monitor.cjs` → mode unchanged in DB |

**QA test approach:**
- Source-level regex tests for audit table creation, `source` field in PUT body, `dataset.serverMode` guard
- Functional: set mode → verify audit log entry exists with correct source
- Regression: existing `liaison-approval-mode.test.ts` and `liaison-approval-3-modes.test.ts` still pass

---

## ACT — Decisions

- **Root cause is unconfirmable** without logging. The fix adds observability first (audit + logging), so the next occurrence can be traced.
- **`dataset.serverMode` guard** prevents the most likely phantom write scenario (change event fires with same-as-server value after page load).
- **Audit table per project DB** (matches existing replication pattern). Not ideal but consistent with current architecture. A future task could centralize settings.
- **No confirmation dialog for mode changes.** The dropdown is a quick toggle — adding a modal would hurt UX. The guard and audit trail are sufficient.
- **`source` field is best-effort.** Browser calls include `source: 'viz-dropdown'`. CLI/curl callers can include their own source string. Default is `'unknown'` if omitted.
