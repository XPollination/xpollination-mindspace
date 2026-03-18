# PDSA: Populate 9 Capabilities Linked to Missions

**Task:** `graph-populate-capabilities`
**Version:** v0.0.1
**Status:** Design

## Plan

Reassign existing capabilities to the 3 new missions and add new capabilities from PLATFORM-001.

### Multi-Mission Decision

The `capabilities.mission_id` FK is single-valued. PLATFORM-001 says capabilities COMPOSE across missions (CAP-AUTH serves both Fair Attribution and Agent-Human Collaboration).

**Decision: Primary mission assignment.** Each capability gets one `mission_id` pointing to its primary mission. A future junction table can be added if multi-mission queries are needed. This avoids schema changes now.

### Capability-to-Mission Mapping (PLATFORM-001 v0.0.6 Part 2)

| ID | Title | Primary Mission | Description |
|----|-------|----------------|-------------|
| cap-auth | CAP-AUTH | mission-agent-human-collab | Authentication, authorization, invite system, JWT, sessions |
| cap-task-engine | CAP-TASK-ENGINE | mission-traversable-context | Workflow engine: state machine, transitions, gates, DNA |
| cap-agent-protocol | CAP-AGENT-PROTOCOL | mission-agent-human-collab | Agent protocol: monitor, recovery, working memory |
| cap-foundation | CAP-FOUNDATION | mission-agent-human-collab | Infrastructure: database, server, deployment, versioning |
| cap-quality | CAP-QUALITY | mission-agent-human-collab | Quality gates: test pass, version bump, PDSA, review |
| cap-graph | CAP-GRAPH | mission-traversable-context | Traversable context graph: hierarchy navigation |
| cap-viz | CAP-VIZ | mission-traversable-context | Dashboard: visualization, drill-down, status |
| cap-provenance | CAP-PROVENANCE | mission-fair-attribution | Authorship tracking, contribution history |
| cap-token | CAP-TOKEN | mission-fair-attribution | Token economics, value attribution |

### Migration: `048-populate-capabilities.sql`

```sql
-- Populate 9 capabilities from PLATFORM-001, linked to missions
-- Updates existing capabilities to new missions, inserts new ones
-- Idempotent: UPDATE + INSERT OR IGNORE

-- Reassign existing capabilities to new missions
UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Authentication, authorization, invite system, JWT, session management'
  WHERE id = 'cap-auth';

UPDATE capabilities SET mission_id = 'mission-traversable-context',
  description = 'Workflow engine: state machine, transitions, gates, DNA'
  WHERE id = 'cap-task-engine';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Agent protocol: monitor skill, recovery, working memory, continuity'
  WHERE id = 'cap-agent-protocol';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Core infrastructure: database, server, deployment, versioning'
  WHERE id = 'cap-foundation';

UPDATE capabilities SET mission_id = 'mission-agent-human-collab',
  description = 'Quality gates: test pass, version bump, PDSA, liaison review'
  WHERE id = 'cap-quality';

-- Insert new capabilities (not in migration 038)
INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-graph', 'mission-traversable-context', 'CAP-GRAPH',
  'Traversable context graph: hierarchy navigation, mission-to-task drill-down', 'active', 11);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-viz', 'mission-traversable-context', 'CAP-VIZ',
  'Dashboard visualization: kanban, hierarchy view, agent status, drill-down', 'active', 12);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-provenance', 'mission-fair-attribution', 'CAP-PROVENANCE',
  'Authorship tracking: contribution history, change attribution, audit trail', 'active', 13);

INSERT OR IGNORE INTO capabilities (id, mission_id, title, description, status, sort_order)
VALUES ('cap-token', 'mission-fair-attribution', 'CAP-TOKEN',
  'Token economics: value attribution, collaboration rewards', 'active', 14);
```

### Existing Capabilities NOT in PLATFORM-001 9

These stay as-is under `mission-mindspace` (backward compat):
- `cap-org-brain` — remains under mission-mindspace
- `cap-integration` — remains under mission-mindspace
- `cap-requirements` — remains under mission-mindspace
- `cap-marketplace` — remains under mission-mindspace
- `cap-release` — remains under mission-mindspace

## Do

DEV creates `api/db/migrations/048-populate-capabilities.sql`.

## Study

Verify:
- 5 existing capabilities reassigned to new missions
- 4 new capabilities inserted
- 5 legacy capabilities still under mission-mindspace
- Total capabilities >= 14 (9 PLATFORM-001 + 5 legacy)
- Each of the 3 new missions has at least one capability

## Act

### Design Decisions
1. **Primary mission only**: Single FK, no junction table. Simplest approach.
2. **UPDATE existing, INSERT new**: Avoids deleting and recreating. Preserves IDs referenced elsewhere.
3. **Legacy capabilities kept**: cap-org-brain, cap-integration etc. stay under mission-mindspace.
4. **sort_order 11-14**: New capabilities continue after existing sort_order (1-10).
