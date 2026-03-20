# PDSA: Design — Multi-Mission Capability Composition via Relationships

**Task:** `multi-mission-composition-design`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem

Capabilities currently use `capabilities.mission_id` FK — one capability belongs to exactly one mission. Real capabilities often contribute to multiple missions (e.g., `cap-org-brain` supports both Fair Attribution and Traversable Context). The `node_relationships` table (migration 058) enables multi-mission composition but nothing uses it yet.

### Solution

1. **Migration**: Seed `COMPOSES` relationships from existing `capabilities.mission_id` FKs
2. **Query layer**: Add relationship-aware queries to viz/server.js
3. **Knowledge Browser**: Show cross-references when a capability belongs to multiple missions
4. **Breadcrumb**: Support multiple parent missions in breadcrumb navigation

### Migration 059: Seed COMPOSES Relationships

```sql
-- 059-seed-composes-relationships.sql
-- Populate node_relationships from existing capabilities.mission_id FKs
-- This is ADDITIVE — mission_id column remains for backward compat

INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
SELECT 'mission', c.mission_id, 'COMPOSES', 'capability', c.id, 'system'
FROM capabilities c
WHERE c.mission_id IS NOT NULL;

-- Also seed IMPLEMENTS relationships from requirements.capability_id
INSERT OR IGNORE INTO node_relationships (source_type, source_id, relation, target_type, target_id, created_by)
SELECT 'capability', r.capability_id, 'IMPLEMENTS', 'requirement', r.id, 'system'
FROM requirements r
WHERE r.capability_id IS NOT NULL;
```

### Cross-Reference Query in Knowledge Browser

When rendering a capability page (`typePrefix === 'c'`), query for all missions that COMPOSE this capability:

```javascript
// In renderNodePage(), after version timeline section
let parentMissions = [];
if (typePrefix === 'c') {
  try {
    parentMissions = db.prepare(`
      SELECT m.id, m.title, m.short_id, m.status
      FROM node_relationships nr
      JOIN missions m ON m.id = nr.source_id
      WHERE nr.relation = 'COMPOSES'
        AND nr.target_type = 'capability'
        AND nr.target_id = ?
      ORDER BY m.title ASC
    `).all(node.id);
  } catch (e) { /* table may not exist */ }
}
```

### Cross-Reference Section HTML

Show when capability has >1 parent mission:

```javascript
const crossRefHtml = parentMissions.length > 1 ? `
  <section style="margin-top:16px;padding:12px;background:var(--bg-secondary);border-radius:8px;">
    <h3 style="font-size:14px;margin-bottom:8px;">Also contributes to</h3>
    ${parentMissions
      .filter(m => m.id !== node.mission_id)  // exclude primary mission (already in breadcrumb)
      .map(m => `
        <a href="/m/${m.short_id}" style="display:inline-block;padding:4px 8px;margin:2px;border-radius:4px;background:var(--bg-card);border:1px solid var(--border);font-size:12px;text-decoration:none;color:var(--text-primary);">
          ${m.title}
        </a>
      `).join('')}
  </section>
` : '';
```

### Breadcrumb Enhancement

Current breadcrumb shows single mission. For multi-mission capabilities, show primary mission (from `mission_id` FK) plus a count badge:

```javascript
// In buildBreadcrumb(), for capability nodes
if (node.mission_title && node.mission_short_id) {
  const extraCount = parentMissions.length - 1;
  const badge = extraCount > 0 ? ` <span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 4px;border-radius:3px;">+${extraCount}</span>` : '';
  crumbs.push({ label: node.mission_title + badge, href: `/m/${node.mission_short_id}/${slugify(node.mission_title)}` });
}
```

### Mission Overview API Update

Update `/api/mission-overview` to also count capabilities via relationships (not just FK):

```javascript
// After existing FK-based capability query, add relationship-based ones
try {
  const relCaps = db.prepare(`
    SELECT DISTINCT nr.target_id as capability_id
    FROM node_relationships nr
    WHERE nr.relation = 'COMPOSES'
      AND nr.source_type = 'mission'
      AND nr.source_id = ?
      AND nr.target_type = 'capability'
  `).all(m.id);
  // Merge with FK-based caps, deduplicate by id
} catch (e) { /* skip */ }
```

### Files to Modify

| File | Change |
|------|--------|
| `api/db/migrations/059-seed-composes-relationships.sql` | Seed COMPOSES + IMPLEMENTS from existing FKs |
| `viz/server.js` | Cross-reference section, breadcrumb badge, mission overview merge |

### Decision Points Resolved

1. **Incremental migration**: Only COMPOSES and IMPLEMENTS seeded. Other relationship types added as needed. FK columns remain for backward compat.
2. **Primary mission from FK**: Breadcrumb still uses `mission_id` as primary. Cross-references show additional missions from relationships. No FK removal.
3. **Count badge in breadcrumb**: "+N" badge next to primary mission name when capability has cross-references. Clicking badge scrolls to cross-reference section.

## Do

DEV:
1. Create migration `059-seed-composes-relationships.sql`
2. Add cross-reference query + section to renderNodePage() for capabilities
3. Add breadcrumb count badge for multi-mission capabilities
4. Update mission overview API to include relationship-based capabilities

## Study

Verify:
- Migration seeds COMPOSES for all capabilities with mission_id
- Migration seeds IMPLEMENTS for all requirements with capability_id
- Capability pages show "Also contributes to" when >1 mission
- Breadcrumb shows "+N" badge for multi-mission capabilities
- Mission overview includes relationship-based capabilities

## Act

### Design Decisions
1. **Seed from existing FKs**: No data loss. Relationships mirror current FK structure. Additional cross-mission relationships added manually via CLI.
2. **INSERT OR IGNORE**: Idempotent — safe to re-run migration.
3. **FK columns preserved**: `capabilities.mission_id` stays. Relationships are additive layer.
4. **Primary vs secondary**: FK = primary mission (breadcrumb). Relationships = all missions including secondary.
5. **No removal scope**: Explicitly out of scope per DNA. FK→relationship migration is incremental.
