# PDSA: Viz Version History Persistent — v0.0.1

## PLAN

### Problem

Thomas reports version history content is empty. The button exists but content doesn't load or render.

### Current State

The infrastructure already exists:
1. **5 changelog.json files** exist (`viz/versions/v0.0.1..v0.0.5/changelog.json`) with `{version, title, date, changes[]}`
2. **Server endpoint** `/api/changelogs` at `viz/server.js:286` reads all version dirs, returns sorted array
3. **Client** `showPastChanges()` fetches `/api/changelogs` and renders version + title + date + changes list
4. **Styling** exists (`.past-changes`, `.version-entry`, `.version-title`, `.version-date`)

### Root Cause Analysis

Two likely causes:
1. **Fetch error swallowed silently** — the catch block replaces content with "Could not load version history" but Thomas says "content is empty" not error text. The `pastChangesList.innerHTML` might not update if `data.changelogs` is an empty array (empty join = empty string).
2. **Endpoint returns empty array** — `versionsDir` path may fail to read dirs (permissions, symlink resolution, etc.)

### Design

Two fixes:

#### 1. Add max 33 limit

In `/api/changelogs` endpoint and client `showPastChanges()`:

Server (`viz/server.js`):
```javascript
// Line 290: add .slice(0, 33) after sort
const dirs = fs.readdirSync(versionsDir).filter(d => d.startsWith('v')).sort().reverse().slice(0, 33);
```

Client (v0.0.5 `showPastChanges()`):
```javascript
// After fetching changelogs, limit to 33
const changelogs = (data.changelogs || []).slice(0, 33);
```

#### 2. Add empty-state handling and debug visibility

Client `showPastChanges()`:
```javascript
// Show message when no changelogs found
if (!changelogs.length) {
  pastChangesList.innerHTML = '<p style="color:#888;">No version history available yet.</p>';
} else {
  pastChangesList.innerHTML = changelogs.map(cl => `...`).join('');
}
```

Also add console.warn in the catch for debugging:
```javascript
} catch (e) {
  console.warn('Version history fetch failed:', e);
  pastChangesList.innerHTML = '<p>Could not load version history</p>';
}
```

### Changes Required

1. **`viz/server.js`** (~1 line):
   - Add `.slice(0, 33)` to `/api/changelogs` endpoint

2. **`viz/versions/v0.0.5/index.html`** (~5 lines):
   - Add `.slice(0, 33)` to changelog rendering
   - Add empty-state message
   - Add console.warn for debug

### What This Does NOT Do

- Does NOT restructure changelog storage (changelog.json per version works fine)
- Does NOT add pagination (33 limit + future pruning is sufficient)
- Does NOT add new UI elements beyond the empty-state message
- Does NOT change the changelog.json format

### Acceptance Criteria

1. Version history shows content (not empty) when changelog.json files exist
2. Max 33 entries displayed
3. Newest first, oldest last
4. Entries are permanent (sourced from changelog.json files)
5. Empty state shows helpful message instead of blank panel

## DO

Implementation by DEV agent. ~1 line server + ~5 lines client.

## STUDY

- Click "Version History" button — verify entries appear with date + content
- Verify newest version appears first
- Verify max 33 limit

## ACT

If approved: all future viz versions must include changelog.json as part of the version deployment process.
