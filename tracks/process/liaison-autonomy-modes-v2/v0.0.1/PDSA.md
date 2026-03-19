# PDSA: Liaison Autonomy Modes v2

**Task:** `liaison-autonomy-modes-v2`
**Version:** v0.0.1
**Status:** Design

## Plan

### Three Changes

1. **Rename auto → autopilot**: Prevents "rubber-stamp" interpretation after context loss
2. **Per-project per-user settings**: Different trust levels for different projects
3. **Viz color badges**: At-a-glance mode visibility per project

### Mode Definitions

| Mode | Color | LIAISON Behavior |
|------|-------|-----------------|
| `autopilot` | Green | LIAISON drives: reviews, documents reasoning, executes transition. No human interaction. |
| `semi` | Amber | LIAISON presents full details, then STOPS. Human types decision. |
| `manual` | Red | LIAISON presents details, tells human to click Confirm in viz. Engine requires `human_confirmed=true`. |

### Migration: `054-rename-auto-to-autopilot.sql`

```sql
-- Rename 'auto' and 'auto-approval' to 'autopilot' in all settings
UPDATE system_settings SET value = 'autopilot'
WHERE key = 'liaison_approval_mode' AND value IN ('auto', 'auto-approval');

UPDATE user_project_settings SET value = 'autopilot'
WHERE key = 'liaison_approval_mode' AND value IN ('auto', 'auto-approval');
```

### API Changes (viz/server.js)

**GET `/api/settings/liaison-approval-mode`**
- With `?project=X`: Returns per-project setting for current user, falls back to global
- Without project: Returns global setting

```javascript
// Query chain: per-user-per-project → global fallback
const perProject = db.prepare(
  `SELECT value FROM user_project_settings
   WHERE user_id = ? AND project_slug = ? AND key = 'liaison_approval_mode'`
).get(userId, projectSlug);

if (perProject) return perProject.value;

// Fallback to global
const global = db.prepare(
  `SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'`
).get();
return global?.value || 'semi'; // default to semi if unset
```

**PUT `/api/settings/liaison-approval-mode`**
- With `{project, mode}`: Sets per-project for current user
- With `{mode}` only: Sets global — requires `{confirm: true}`
- Without confirm on global: Returns 400 with "This will override settings for all N projects. Include confirm:true."

```javascript
// Validation
const validModes = ['autopilot', 'semi', 'manual'];
if (!validModes.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });

if (project) {
  // Per-project
  db.prepare(`INSERT OR REPLACE INTO user_project_settings (user_id, project_slug, key, value)
              VALUES (?, ?, 'liaison_approval_mode', ?)`).run(userId, project, mode);
} else {
  // Global — require confirmation
  if (!body.confirm) {
    const count = db.prepare('SELECT COUNT(DISTINCT project_slug) FROM user_project_settings').get();
    return res.status(400).json({
      error: `This will set mode for ALL projects. Include confirm:true to proceed.`,
      project_count: count
    });
  }
  db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('liaison_approval_mode', ?)`).run(mode);
}
```

### Viz Changes

**Project filter dropdown**: Each project name gets a colored dot:
- `●` green for autopilot
- `●` amber for semi
- `●` red for manual

Fetch modes for all projects on load via `/api/settings/liaison-approval-mode?project=all` (new endpoint variant returning map).

### Backward Compatibility

- Reading `auto` from DB → migration converts to `autopilot`
- API response always uses `autopilot` (never `auto`)
- Skill docs updated to reference `autopilot`

## Do

DEV implements:
1. Migration 054
2. API GET/PUT changes in viz/server.js
3. Viz colored dots in project filter
4. Skill doc updates (monitor + pm-status)

## Study

Verify:
- `curl /api/settings/liaison-approval-mode` returns `autopilot` (not `auto`)
- `curl /api/settings/liaison-approval-mode?project=xpollination-mcp-server` returns per-project or falls back
- PUT without confirm on global → 400
- PUT with confirm:true on global → 200
- Viz shows colored dots per project

## Act

### Design Decisions
1. **`semi` as default**: Safest default for new projects. Human decides, LIAISON presents.
2. **Confirmation guard on global**: Prevents accidental "set everything to autopilot" with one click.
3. **Per-user per-project**: Different team members may want different autonomy levels.
4. **Migration converts existing values**: No manual intervention needed.
5. **Color mapping**: Green=go (autopilot), amber=caution (semi), red=stop (manual). Traffic light metaphor.
