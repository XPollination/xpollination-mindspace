# PDSA: Cleanup Docker Container and Legacy Missions

**Task:** `cleanup-docker-legacy-missions`
**Version:** v0.0.1
**Status:** Design

## Plan

### Two Parts

1. **Docker cleanup**: Remove stopped mindspace-prod container. Keep volume as backup for 7 days.
2. **DB cleanup**: Remove legacy/duplicate missions, reassign orphaned capabilities.

### Part 1: Docker

```bash
# Remove container (already stopped)
docker rm mindspace-prod

# Volume backup: leave for 7 days, then:
# docker volume rm xpollination-mcp-server_mindspace-prod-data

# Update docker-compose.prod.yml: remove viz/api service definitions
# Keep brain + qdrant services (still Docker-hosted)
```

### Part 2: DB Cleanup Migration

Migration `055-cleanup-legacy-missions.sql`:

```sql
-- Step 1: Reassign capabilities from legacy missions to PLATFORM-001 missions
-- Capabilities still pointing to mission-mindspace need reassignment
-- (Most already reassigned by migration 048, but check for stragglers)
UPDATE capabilities SET mission_id = 'mission-agent-human-collab'
WHERE mission_id = 'mission-mindspace' AND id IN ('cap-org-brain', 'cap-integration', 'cap-requirements', 'cap-marketplace', 'cap-release');

-- Step 2: Delete legacy missions
DELETE FROM missions WHERE id = 'b6498cfd-3d33-476e-89c0-e70277d847b3'; -- original duplicate
DELETE FROM missions WHERE id = 'mission-mindspace'; -- migration 038 generic
DELETE FROM missions WHERE id = 'mission-road-001'; -- ROAD-001 was a roadmap, not a mission

-- Step 3: Clean up capability_tasks and capability_requirements that reference deleted data
-- (These junction tables may have stale entries)
DELETE FROM capability_tasks WHERE capability_id NOT IN (SELECT id FROM capabilities);
DELETE FROM capability_requirements WHERE capability_id NOT IN (SELECT id FROM capabilities);
```

### Verification Queries

```sql
-- Should return exactly 3 missions
SELECT id, title, status FROM missions;
-- Expected: mission-fair-attribution, mission-traversable-context, mission-agent-human-collab

-- No orphaned capabilities
SELECT c.id, c.mission_id FROM capabilities c
LEFT JOIN missions m ON c.mission_id = m.id
WHERE m.id IS NULL;
-- Expected: 0 rows

-- All capabilities have valid missions
SELECT c.id, c.title, m.title as mission FROM capabilities c JOIN missions m ON c.mission_id = m.id;
```

### docker-compose.prod.yml Update

Remove `viz` and `api` service definitions. Keep `brain` and `qdrant` services. Add comment explaining migration to systemd.

## Do

DEV:
1. Run Docker cleanup commands (requires thomas user for docker)
2. Create migration `055-cleanup-legacy-missions.sql`
3. Update `docker-compose.prod.yml`

## Study

Verify:
- `docker ps -a | grep mindspace-prod` returns nothing
- `SELECT count(*) FROM missions WHERE status = 'active'` returns 3
- No orphaned capabilities (JOIN verification)
- docker-compose.prod.yml has no viz/api services

## Act

### Design Decisions
1. **Reassign before delete**: Move orphaned capabilities to agent-human-collab (catch-all mission) before deleting legacy missions. Prevents FK violations.
2. **7-day volume retention**: Safety net in case data is needed for comparison.
3. **Migration, not manual SQL**: Reproducible cleanup that runs through normal migration pipeline.
4. **Keep brain/qdrant in Docker**: Only viz/api moved to systemd. Brain has its own Docker networking.
