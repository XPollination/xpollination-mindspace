# PDSA: Knowledge Browser Navigation

**Task:** `kb-navigation`
**Version:** v0.0.1
**Status:** Design

## Plan

### Three Navigation Axes

1. **Up (Breadcrumb)**: Where does this node sit in the hierarchy?
2. **Down (Children)**: What does this node contain?
3. **Sideways (Cross-references + Siblings)**: What else connects here?

### Breadcrumb Generation

```javascript
function buildBreadcrumb(typePrefix, node, db) {
  const crumbs = [{ label: 'Mindspace', url: '/' }];

  if (typePrefix === 'm') {
    crumbs.push({ label: node.title, url: null }); // current = not linked
  }

  if (typePrefix === 'c') {
    const mission = db.prepare('SELECT title, short_id FROM missions WHERE id = ?').get(node.mission_id);
    crumbs.push({ label: mission.title, url: `/m/${mission.short_id}/${slugify(mission.title)}` });
    crumbs.push({ label: node.title, url: null });
  }

  if (typePrefix === 'r') {
    const cap = db.prepare('SELECT id, title, short_id, mission_id FROM capabilities WHERE id = ?').get(node.capability_id);
    const mission = db.prepare('SELECT title, short_id FROM missions WHERE id = ?').get(cap.mission_id);
    crumbs.push({ label: mission.title, url: `/m/${mission.short_id}/${slugify(mission.title)}` });
    crumbs.push({ label: cap.title, url: `/c/${cap.short_id}/${slugify(cap.title)}` });
    crumbs.push({ label: node.title, url: null });
  }

  return crumbs;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

### Children Queries (already in kb-render-page, enhanced here)

Same queries from kb-render-page but with `short_id` for link generation:
- Mission → `SELECT id, title, description, short_id FROM capabilities WHERE mission_id = ?`
- Capability → `SELECT id, req_id_human, title, description, short_id FROM requirements WHERE capability_id = ?`
- Requirement → Tasks via `dna_json LIKE '%{req_id_human}%'`

### Siblings

```javascript
function getSiblings(typePrefix, node, db) {
  if (typePrefix === 'c') {
    // Other capabilities under same mission
    return db.prepare('SELECT id, title, short_id FROM capabilities WHERE mission_id = ? AND id != ? ORDER BY sort_order')
      .all(node.mission_id, node.id);
  }
  if (typePrefix === 'r') {
    // Other requirements under same capability
    return db.prepare('SELECT id, req_id_human, title, short_id FROM requirements WHERE capability_id = ? AND id != ? ORDER BY req_id_human')
      .all(node.capability_id, node.id);
  }
  return [];
}
```

### Cross-References

With current single `mission_id` FK, cross-references are limited. But the design supports future many-to-many:

```javascript
function getCrossRefs(typePrefix, node, db) {
  // Future: when junction table exists, query all missions for a capability
  // For now: single mission_id means no cross-references for capabilities
  return [];
}
```

### HTML Template Enhancement

Add to `renderNodePage()`:
- Breadcrumb bar below title
- Siblings section ("Also under this mission: ...")
- Each child card links to `/{type}/{short_id}/{slug}`

## Do

DEV enhances `renderNodePage()` in viz/server.js:
1. Add `buildBreadcrumb()` function
2. Add `getSiblings()` function
3. Render breadcrumb as clickable path
4. Render siblings as horizontal list
5. Ensure all links use `/{type}/{short_id}/{slug}` pattern

## Study

Verify:
- Breadcrumb on mission page: `Mindspace > [Mission Name]`
- Breadcrumb on capability page: `Mindspace > [Mission Name] > [Capability Name]`
- Breadcrumb on requirement page: Full 4-level path
- All breadcrumb segments are clickable (except current page)
- Children cards link correctly
- Siblings show other nodes at same level

## Act

### Design Decisions
1. **Slugify for URLs**: Convert titles to URL-safe slugs. Decorative only — short_id is the lookup key.
2. **Current page not linked**: Last breadcrumb segment is plain text, not a link. Standard UX pattern.
3. **No cross-references yet**: Single mission_id FK limits this. Placeholder ready for junction table.
4. **Siblings as secondary**: Small horizontal list, not prominent cards. Primary navigation is up/down.
