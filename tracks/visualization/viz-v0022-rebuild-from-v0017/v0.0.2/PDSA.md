# PDSA: Viz v0.0.22 — Fix Static File Serving to Use Active Symlink

**Task:** `viz-v0022-rebuild-from-v0017`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** PDSA agent
**Rework:** v0.0.1 investigation missed the real bug — server serves from `viz/` root, not `viz/active/`

---

## PLAN

### Problem Statement (Corrected)

The v0.0.1 PDSA compared versioned files (v0.0.17 vs v0.0.21) and found no regressions. The liaison correctly identified that this was the wrong comparison — the versioned files are correct but **never served by the TEST server**.

**Root cause:** The root `viz/server.js` (used by TEST on port 4200) resolves static files via `path.join(__dirname, filePath)` where `__dirname` = `viz/`. This serves `viz/index.html` — a stale 2017-line file with wrong dropdown order — instead of the current versioned `viz/active/index.html` (2283 lines via symlink).

**Proof:**
- Root `viz/index.html` line 885-888: `manual, semi, auto, auto-approval` (WRONG order)
- Versioned `viz/versions/v0.0.21/index.html` line 963-966: `manual, semi, auto-approval, auto` (CORRECT order)
- Root `viz/index.html`: 2017 lines (pre-v0.0.17 content)
- Versioned `viz/versions/v0.0.21/index.html`: 2283 lines (all features present)

**PROD (port 4100) is unaffected** because it runs `viz/active/server.js`, where `__dirname` resolves through the symlink to `viz/versions/v0.0.21/`, correctly serving the versioned `index.html`.

### Architecture Analysis

**Two server deployment patterns:**

| Env | Port | Command | `__dirname` | Serves HTML from |
|-----|------|---------|-------------|-----------------|
| TEST | 4200 | `node viz/server.js 4200` | `viz/` | `viz/index.html` (STALE) |
| PROD | 4100 | `node viz/active/server.js 4100` | `viz/versions/v0.0.21/` | `viz/versions/v0.0.21/index.html` (CORRECT) |

The versioning system works correctly for PROD. TEST bypasses it because it runs the root `server.js` instead of the symlinked one.

### Design Decisions

**D1: Fix the root `viz/server.js` to serve static files from `viz/active/` instead of `viz/`.**

Change lines 654-655:
```javascript
// BEFORE:
let filePath = pathname === '/' ? '/index.html' : pathname;
filePath = path.join(__dirname, filePath);

// AFTER:
let filePath = pathname === '/' ? '/index.html' : pathname;
const activeDir = path.join(__dirname, 'active');
const serveDir = fs.existsSync(activeDir) ? fs.realpathSync(activeDir) : __dirname;
filePath = path.join(serveDir, filePath);
```

This makes the root server.js serve from whichever directory the `active` symlink points to. If `active` doesn't exist (e.g., first deployment), it falls back to `__dirname`.

The security check on line 658 also needs updating:
```javascript
// BEFORE:
if (!filePath.startsWith(__dirname)) {

// AFTER:
if (!filePath.startsWith(serveDir)) {
```

**D2: Do NOT delete or modify root `viz/index.html`.**

The root `viz/index.html` becomes irrelevant once the server serves from `active/`. Keeping it as-is avoids any risk of breaking a fallback path. It will naturally become a historical artifact.

**D3: The versioned `server.js` (in version directories) is unchanged.**

When PROD runs `viz/active/server.js`, `__dirname` already resolves correctly through the symlink. No change needed for the versioned server.js — only the root `viz/server.js` needs the fix.

**D4: No new viz version directory needed.**

This fix modifies `viz/server.js` (root), not a versioned file. The `viz/server.js` is not part of the versioning system — it's infrastructure. The current `viz/active` → `v0.0.21` symlink remains correct.

### Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | Lines 654-658: Resolve static files from `active/` symlink instead of `__dirname` |

### Verification Plan

1. **Static file resolution:** After fix, `GET /` on port 4200 returns content from `viz/active/index.html` (2283 lines, v0.0.21 content), not `viz/index.html` (2017 lines).
2. **Dropdown order:** Page served on port 4200 has `manual, semi, auto-approval, auto` (correct order from v0.0.21).
3. **Feature presence:** Search page source for `showCapabilityDetail` (drilldown), `suspect-status-bar` (suspect viz), `auto-approval` option (wf-v18) — all present.
4. **PROD unaffected:** Port 4100 continues serving correctly (no change to versioned server.js).
5. **Security:** Path traversal check still works — `filePath.startsWith(serveDir)` prevents `../../` attacks.
6. **Fallback:** If `active` symlink is missing, server falls back to `__dirname` (no crash).
7. **Other static assets:** CSS, JS, images served correctly from the active version directory.
8. **Service restart:** After deploying fix, restart the test service: `systemctl --user restart mindspace-test` or kill/restart the node process on port 4200.

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
