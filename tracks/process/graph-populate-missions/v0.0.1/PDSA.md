# PDSA: Populate 3 Missions from PLATFORM-001

**Task:** `graph-populate-missions`
**Version:** v0.0.1
**Status:** Design

## Plan

Replace the single generic mission with 3 purpose-driven missions from PLATFORM-001.

### Current State
- Migration 038: 1 mission (`mission-mindspace`) with all 10 capabilities
- All capabilities have `mission_id = 'mission-mindspace'`

### Target State (PLATFORM-001 v0.0.6 Part 1)
3 missions, each representing a WHY:

1. **Fair Attribution** — Measurable collaboration where every contribution is tracked
2. **Traversable Context** — Decision context available at every level of the hierarchy
3. **Agent-Human Collaboration** — Work together without chaos

### Migration: `047-populate-missions.sql`

```sql
-- Populate 3 missions from PLATFORM-001
-- Idempotent: INSERT OR IGNORE
-- Does NOT delete the existing generic mission (backward compat)

INSERT OR IGNORE INTO missions (id, slug, title, description, status)
VALUES (
  'mission-fair-attribution',
  'MISSION-FAIR-ATTR',
  'Fair Attribution',
  'Measurable collaboration — every contribution is tracked, provenance is clear, and value flows to creators',
  'active'
);

INSERT OR IGNORE INTO missions (id, slug, title, description, status)
VALUES (
  'mission-traversable-context',
  'MISSION-TRAV-CTX',
  'Traversable Context',
  'Decision context at every level — from mission intent through capability design to task execution and back',
  'active'
);

INSERT OR IGNORE INTO missions (id, slug, title, description, status)
VALUES (
  'mission-agent-human-collab',
  'MISSION-AH-COLLAB',
  'Agent-Human Collaboration',
  'Humans and agents working together without chaos — clear protocols, quality gates, and shared understanding',
  'active'
);
```

## Do

DEV creates `api/db/migrations/047-populate-missions.sql` with the SQL above.

## Study

Verify:
- `SELECT count(*) FROM missions WHERE id LIKE 'mission-%'` returns >= 4 (3 new + 1 existing)
- Each mission has slug, title, description, status=active
- INSERT OR IGNORE: running twice is safe
- Existing `mission-mindspace` is NOT deleted (capabilities still reference it)

## Act

### Design Decisions

1. **Keep existing mission:** `mission-mindspace` stays. Deleting it would break capability FK references. Future task (`graph-populate-capabilities`) will reassign capabilities to the new missions.
2. **Slug format:** `MISSION-*` prefix, uppercase, abbreviated. Consistent with `ROAD-001` convention.
3. **ID format:** `mission-*` prefix, lowercase-kebab. Consistent with existing `mission-mindspace`.
4. **Capabilities NOT reassigned here:** Per task scope, this is missions only. Capability-to-mission linking is `graph-populate-capabilities`.
5. **3 missions compose capabilities:** A capability can serve multiple missions. This many-to-many relationship will be handled by the capabilities task, not here.
