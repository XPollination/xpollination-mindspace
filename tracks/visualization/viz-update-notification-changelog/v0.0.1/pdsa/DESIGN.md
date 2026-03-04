# PDSA: Viz Update Notification & Changelog — v0.0.1

## PLAN

### Problem
When viz is updated to a new version (symlink switches from v0.0.1 to v0.0.2), Thomas doesn't notice. Updates deploy silently. Users need to:
1. Know an update is available
2. See what changed before accepting
3. Access past change history

### Design

Four components: version detection API, update notification banner, changelog system, and past changes section.

#### 1. Version Detection API (server.js)

Add `GET /api/version` endpoint that returns the current active version by reading the symlink target.

```javascript
// GET /api/version — returns current active viz version
app.get('/api/version', (req, res) => {
  try {
    const activePath = path.join(__dirname, 'active');
    const target = fs.readlinkSync(activePath); // e.g., "versions/v0.0.2"
    const version = target.match(/v(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
    res.json({ version, target });
  } catch (e) {
    res.json({ version: 'unknown', error: e.message });
  }
});
```

#### 2. Changelog Files (per version)

Each version directory gets a `changelog.json`:

```
viz/versions/v0.0.1/changelog.json
viz/versions/v0.0.2/changelog.json
viz/versions/v0.0.3/changelog.json  (future)
```

Format:
```json
{
  "version": "0.0.2",
  "date": "2026-03-04",
  "title": "Kanban Board Redesign",
  "changes": [
    "Replaced warehouse funnel with Kanban board layout",
    "5 phase columns: QUEUE, ACTIVE, REVIEW, APPROVED, COMPLETE",
    "Task cards with color-coded role badges",
    "Agent status bar showing current assignments",
    "Removed non-process stations (HOMEPAGE entries)",
    "Blocked/cancelled tasks in separate bottom section"
  ]
}
```

Add `GET /api/changelog/:version` and `GET /api/changelogs` endpoints to server.js:

```javascript
// GET /api/changelog/:version
app.get('/api/changelog/:version', (req, res) => {
  const changelogPath = path.join(__dirname, 'versions', `v${req.params.version}`, 'changelog.json');
  if (fs.existsSync(changelogPath)) {
    res.json(JSON.parse(fs.readFileSync(changelogPath, 'utf8')));
  } else {
    res.status(404).json({ error: 'Changelog not found' });
  }
});

// GET /api/changelogs — all versions with changelogs
app.get('/api/changelogs', (req, res) => {
  const versionsDir = path.join(__dirname, 'versions');
  const versions = fs.readdirSync(versionsDir)
    .filter(d => d.startsWith('v'))
    .sort()
    .reverse(); // newest first
  const changelogs = versions.map(v => {
    const p = path.join(versionsDir, v, 'changelog.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    return { version: v.replace('v', ''), changes: [] };
  });
  res.json(changelogs);
});
```

#### 3. Update Notification Banner (index.html)

Client-side version checking on each poll cycle:

- Store `acceptedVersion` in `localStorage`
- On each `pollData()`, also fetch `/api/version`
- If server version differs from accepted version, show update banner
- Banner shows: "Update available: v0.0.X" with "View Changes" and "Update Now" buttons
- "View Changes" opens changelog popup
- "Update Now" sets `acceptedVersion` in localStorage and reloads page
- User stays on current cached version until they click Update

```html
<div id="update-banner" class="update-banner" style="display:none;">
  <span>New version available: <strong id="update-version"></strong></span>
  <button id="view-changes-btn">View Changes</button>
  <button id="accept-update-btn">Update Now</button>
  <button id="dismiss-update-btn">Dismiss</button>
</div>
```

CSS: Fixed position banner at top of page, attention-grabbing but not blocking.

#### 4. Changelog Popup & Past Changes Section (index.html)

- **Changelog popup**: Modal showing the changes for the new version. Lists bullet points from changelog.json.
- **Past changes section**: Accessible from settings area. Shows all version changelogs in reverse chronological order. Fetches from `/api/changelogs`.

```html
<!-- Changelog Modal -->
<div id="changelog-modal" class="modal" style="display:none;">
  <div class="modal-content">
    <h2>What's New in v<span id="changelog-version"></span></h2>
    <ul id="changelog-list"></ul>
    <div class="modal-actions">
      <button id="changelog-update-btn">Update Now</button>
      <button id="changelog-close-btn">Close</button>
    </div>
  </div>
</div>
```

#### 5. Completion Gate (NOT in this task scope)

The task description mentions a completion gate requiring changelog summary. However, this crosses into workflow engine territory. The simpler approach: require `changelog.json` to exist in the version directory as part of the dev implementation checklist. The version enforcement gate (v0.0.2) already fires on submissions — it could be extended to check for changelog.json in a future iteration.

For now: document as a protocol requirement, not an engine gate.

### Changes Required

1. **`viz/server.js`** (~30 lines):
   - Add `GET /api/version` endpoint (readlink active symlink)
   - Add `GET /api/changelog/:version` endpoint
   - Add `GET /api/changelogs` endpoint

2. **`viz/index.html`** (~60 lines):
   - HTML: Update banner, changelog modal, past changes section trigger
   - CSS: Banner and modal styling
   - JS: Version check in pollData(), update banner logic, changelog fetch, localStorage

3. **`viz/versions/v0.0.1/changelog.json`** (new):
   - Changelog for v0.0.1 (initial version with flow arrows + role badges)

4. **`viz/versions/v0.0.2/changelog.json`** (new):
   - Changelog for v0.0.2 (Kanban board redesign)

5. **Version directory + symlink**: Create v0.0.N for this feature, update active symlink

### What This Does NOT Do

- Does NOT add a workflow engine gate for changelog (protocol requirement only)
- Does NOT add version rollback UI (symlink rollback is CLI-only)
- Does NOT show git commit history (changelog is human-curated)
- Does NOT block the user from using the UI while update is available (banner is informational)

### Acceptance Criteria

1. `/api/version` returns current active version from symlink
2. Update banner appears when server version differs from localStorage accepted version
3. "View Changes" shows changelog popup with bullet-point list
4. "Update Now" sets localStorage and reloads
5. Past changes section shows all version changelogs
6. `changelog.json` exists for v0.0.1 and v0.0.2

## DO

Implementation by DEV agent. ~30 lines server.js, ~60 lines index.html, 2 changelog.json files.

## STUDY

After implementation:
- Change active symlink manually, verify notification appears
- Click "View Changes", verify changelog content
- Click "Update Now", verify page reloads with new version
- Check past changes section shows all versions

## ACT

If Thomas approves: every future viz version must include a `changelog.json`. Document as dev checklist item.
