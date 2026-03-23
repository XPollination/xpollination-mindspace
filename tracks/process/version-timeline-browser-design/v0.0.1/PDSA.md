# PDSA: Design — Version Timeline in Knowledge Browser

**Task:** `version-timeline-browser-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem

Capability document pages (`/c/:short_id`) show content but no version history. The `capability_version_history` table (migration 057) stores version entries with changelog, contributing tasks, and requirements satisfied. Users need to see this timeline on the capability page.

### Solution

Add an expandable "Version History" section to capability document pages in `renderNodePage()`. Shows latest 3 versions by default, with expand to see all.

### Data Query

In `renderNodePage()`, when `typePrefix === 'c'`:

```javascript
let versionHistory = [];
try {
  versionHistory = db.prepare(
    "SELECT version, changelog, contributing_tasks, requirements_satisfied, changed_by, changed_at, pdsa_ref FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC"
  ).all(node.id);
} catch (e) { /* table may not exist */ }
```

### Timeline HTML

```html
<section class="version-timeline" style="margin-top:24px;">
  <h2 style="font-size:18px;margin-bottom:12px;">Version History</h2>
  ${versionHistory.length === 0 ? '<p style="color:var(--muted);">No versions recorded yet.</p>' : ''}
  <div id="version-list">
    ${versionHistory.map((v, i) => `
      <div class="version-entry" style="
        border-left: 3px solid ${i === 0 ? '#22c55e' : '#e5e7eb'};
        padding: 8px 0 8px 16px;
        margin-bottom: 12px;
        ${i >= 3 ? 'display:none;' : ''}
      " ${i >= 3 ? 'class="version-hidden"' : ''}>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:14px;">v${v.version}</strong>
          <span style="font-size:12px;color:var(--muted);">${v.changed_at ? v.changed_at.split('T')[0] : ''} by ${v.changed_by}</span>
        </div>
        ${v.changelog ? `<p style="margin:4px 0;font-size:13px;">${v.changelog}</p>` : ''}
        ${v.contributing_tasks ? `
          <div style="margin-top:4px;font-size:12px;color:var(--muted);">
            Tasks: ${JSON.parse(v.contributing_tasks).join(', ')}
          </div>
        ` : ''}
        ${v.requirements_satisfied ? `
          <div style="margin-top:2px;font-size:12px;color:var(--muted);">
            Requirements: ${JSON.parse(v.requirements_satisfied).join(', ')}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ${versionHistory.length > 3 ? `
    <button onclick="document.querySelectorAll('.version-hidden').forEach(e => e.style.display = 'block'); this.style.display='none';"
      style="background:none;border:1px solid var(--border);padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px;color:var(--muted);">
      Show ${versionHistory.length - 3} more versions
    </button>
  ` : ''}
</section>
```

### Placement

After the children section, before the siblings section in `renderNodePage()`. Only rendered when `typePrefix === 'c'` (capability pages).

### Visual Design

| Element | Style |
|---------|-------|
| Latest version | Green left border (`#22c55e`) |
| Older versions | Gray left border (`#e5e7eb`) |
| Default visible | 3 most recent |
| Expand button | Shows remaining, hides itself |
| Empty state | "No versions recorded yet." muted text |

### Decision Points Resolved

1. **Inline in capability page** (not separate route): Version history is part of the capability context. No need for a separate URL.
2. **Show 3 by default**: Enough for recent context without overwhelming the page. Expand reveals full history.

## Do

DEV:
1. Add version history query in `renderNodePage()` for capability pages
2. Add timeline HTML section after children
3. Add expand/collapse behavior for >3 versions
4. Style with inline CSS (consistent with existing pattern)

## Study

Verify:
- Capability pages with version entries show timeline
- Capability pages without version entries show "No versions recorded yet."
- Latest version has green border, others gray
- Only 3 versions visible by default, expand shows rest
- Contributing tasks and requirements render when present

## Act

### Design Decisions
1. **Inline CSS**: Consistent with existing renderNodePage pattern. No external CSS needed.
2. **3 default visible**: Balances visibility with page length. Power users expand.
3. **Green border for latest**: Visual cue for current version.
4. **Graceful degradation**: Empty state message. JSON parse errors caught.
5. **No diff view**: Explicitly out of scope per DNA. Version entries are standalone summaries.
