# PDSA: Implement — Version Timeline in renderNodePage

**Task:** `version-timeline-browser-impl`
**Version:** v0.0.1
**Status:** Design

## Plan

### What DEV Implements

Add a "Version History" section to `renderNodePage()` in `viz/server.js` for capability pages (`typePrefix === 'c'`).

### 1. Query Version History

After fetching children in `renderNodePage()`, when `typePrefix === 'c'`, query version history:

```javascript
let versionHistory = [];
if (typePrefix === 'c') {
  try {
    versionHistory = db.prepare(
      "SELECT version, changelog, contributing_tasks, requirements_satisfied, changed_by, changed_at, pdsa_ref FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC"
    ).all(node.id);
  } catch (e) { /* table may not exist */ }
}
```

**Note:** The `db` reference is available in `renderNodePage()` — pass it as a parameter if not already accessible. Check how the function currently accesses the database.

### 2. Render Timeline HTML

After the children section, before siblings, add:

```javascript
const versionTimelineHtml = typePrefix === 'c' ? `
  <section style="margin-top:24px;">
    <h2 style="font-size:18px;margin-bottom:12px;">Version History</h2>
    ${versionHistory.length === 0
      ? '<p style="color:var(--muted);">No versions recorded yet.</p>'
      : versionHistory.map((v, i) => `
        <div style="border-left:3px solid ${i === 0 ? '#22c55e' : '#e5e7eb'};padding:8px 0 8px 16px;margin-bottom:12px;${i >= 3 ? 'display:none;' : ''}"
          ${i >= 3 ? 'class="version-hidden"' : ''}>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:14px;">v${v.version}</strong>
            <span style="font-size:12px;color:var(--muted);">${v.changed_at ? v.changed_at.split('T')[0] : ''} by ${v.changed_by}</span>
          </div>
          ${v.changelog ? `<p style="margin:4px 0;font-size:13px;">${v.changelog}</p>` : ''}
          ${v.contributing_tasks ? `<div style="margin-top:4px;font-size:12px;color:var(--muted);">Tasks: ${JSON.parse(v.contributing_tasks).join(', ')}</div>` : ''}
          ${v.requirements_satisfied ? `<div style="margin-top:2px;font-size:12px;color:var(--muted);">Requirements: ${JSON.parse(v.requirements_satisfied).join(', ')}</div>` : ''}
        </div>
      `).join('')}
    ${versionHistory.length > 3 ? `
      <button onclick="document.querySelectorAll('.version-hidden').forEach(e=>e.style.display='block');this.style.display='none';"
        style="background:none;border:1px solid var(--border);padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;color:var(--muted);">
        Show ${versionHistory.length - 3} more versions
      </button>
    ` : ''}
  </section>
` : '';
```

### 3. Insert in Page Template

In the return template string, add `${versionTimelineHtml}` after the children section and before the siblings section.

### Files to Modify

| File | Change |
|------|--------|
| `viz/server.js` | Add version history query + timeline HTML in `renderNodePage()` |

### Test Reference

Tests: `api/__tests__/version-timeline-browser.test.ts`

## Do

DEV:
1. Add version history query for capability pages in `renderNodePage()`
2. Add timeline HTML section with green/gray borders
3. Add expand button for >3 versions
4. Run tests: `npx vitest run api/__tests__/version-timeline-browser`

## Study

Verify:
- Capability pages show "Version History" section
- Versions sorted newest first, latest has green border
- Empty capabilities show "No versions recorded yet."
- >3 versions: first 3 visible, rest hidden with expand button

## Act

### Design Decisions
1. **Capability pages only**: `typePrefix === 'c'` guard. Missions and requirements don't have version history.
2. **Inline CSS**: Consistent with existing renderNodePage pattern.
3. **JSON.parse in template**: Safe because contributing_tasks is always valid JSON or null (enforced by CLI).
4. **Try/catch on query**: Table may not exist in older databases without migration 057.
