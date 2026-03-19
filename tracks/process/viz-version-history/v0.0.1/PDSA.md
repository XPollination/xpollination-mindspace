# PDSA: Version History Browser

**Task:** `viz-version-history`
**Version:** v0.0.1
**Status:** Design

## Plan

### API: GET /api/versions

Reads `viz/versions/` directory, returns sorted list:

```javascript
// viz/server.js
if (pathname === '/api/versions') {
  const versionsDir = path.join(process.cwd(), 'viz', 'versions');
  const dirs = fs.readdirSync(versionsDir).filter(d => d.startsWith('v')).sort(semverSort);
  const activeVersion = fs.readlinkSync(path.join(process.cwd(), 'viz', 'active')).replace('versions/', '');

  const versions = dirs.map(dir => {
    const changelogPath = path.join(versionsDir, dir, 'changelog.json');
    let changelog = {};
    try { changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8')); } catch {}
    return {
      version: dir,
      date: changelog.date || null,
      title: changelog.title || dir,
      changes: changelog.changes || [],
      active: dir === activeVersion
    };
  }).reverse(); // newest first

  sendJson(res, { versions, active: activeVersion });
  return;
}
```

### API: PUT /api/versions/active

Switches active version (admin only):

```javascript
if (pathname === '/api/versions/active' && req.method === 'PUT') {
  const body = await readBody(req);
  const { version } = body;
  const versionDir = path.join(process.cwd(), 'viz', 'versions', version);
  if (!fs.existsSync(versionDir)) {
    return sendJson(res, { error: 'Version not found' }, 404);
  }
  // Update symlink
  const activeLink = path.join(process.cwd(), 'viz', 'active');
  fs.unlinkSync(activeLink);
  fs.symlinkSync(`versions/${version}`, activeLink);
  sendJson(res, { active: version, message: 'Restart viz to apply' });
  return;
}
```

### UI: Version Indicator + History Panel

**Footer version badge** (already exists in some versions):
```html
<span class="version-badge" onclick="toggleVersionPanel()">v0.0.37</span>
```

**Version history panel** (slide-out from right or modal):
```html
<div id="version-panel" class="version-panel" style="display:none">
  <h3>Version History</h3>
  <div id="version-list"></div>
</div>
```

**JavaScript:**
```javascript
async function toggleVersionPanel() {
  const panel = document.getElementById('version-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    const res = await fetch('/api/versions');
    const data = await res.json();
    renderVersionList(data.versions);
  } else {
    panel.style.display = 'none';
  }
}

function renderVersionList(versions) {
  const list = document.getElementById('version-list');
  list.innerHTML = versions.map(v => `
    <div class="version-item ${v.active ? 'active' : ''}">
      <strong>${v.version}</strong> ${v.active ? '(active)' : ''}
      <span class="version-date">${v.date || ''}</span>
      <p>${v.title}</p>
      ${!v.active ? `<button onclick="switchVersion('${v.version}')">Activate</button>` : ''}
    </div>
  `).join('');
}

async function switchVersion(version) {
  if (!confirm(`Switch to ${version}? This will require a restart.`)) return;
  await fetch('/api/versions/active', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version })
  });
  alert('Version switched. Restart the viz service to apply.');
}
```

### Rollback Flow

1. Click version badge → opens panel
2. See all versions with changelogs
3. Click "Activate" on older version
4. Confirm dialog
5. API updates symlink
6. User restarts service (or use lifecycle scripts)

## Do

DEV:
1. Add `/api/versions` and `/api/versions/active` to viz/server.js
2. Add version indicator + panel to new viz version
3. Add CSS for version panel

## Study

Verify:
- `curl /api/versions` returns sorted list with active flag
- Version panel shows all versions
- Switching version updates symlink
- Rollback works (older version activatable)

## Act

### Design Decisions
1. **No auto-restart**: Switching version only changes symlink. User restarts via lifecycle scripts. Safer.
2. **Newest first**: Most recent version at top of list. Natural browsing order.
3. **Confirm dialog**: Prevent accidental version switches.
4. **Self-contained versions**: Each version has its own index.html, server.js, changelog.json. No deltas.
5. **changelog.json**: Already exists in each version. Used as metadata source.
