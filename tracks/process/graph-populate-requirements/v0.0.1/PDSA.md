# PDSA: Create Requirements Under Each Capability

**Task:** `graph-populate-requirements`
**Version:** v0.0.1
**Status:** Design

## Plan

Seed at least one requirement per PLATFORM-001 capability. Requirements are the HOW — what users/agents will do.

### Requirements Table Columns
- `id` TEXT PK
- `project_slug` TEXT FK → projects(slug) = 'mindspace'
- `req_id_human` TEXT (human-readable ID, UNIQUE per project)
- `title` TEXT
- `description` TEXT
- `status` TEXT (draft/active/deprecated)
- `priority` TEXT (low/medium/high/critical)
- `created_by` TEXT FK → users(id) = 'system'
- `capability_id` TEXT FK → capabilities(id) (added migration 045)

### Requirements from PLATFORM-001 v0.0.6

| req_id_human | capability_id | title | priority |
|-------------|--------------|-------|----------|
| REQ-AUTH-001 | cap-auth | User Login | high |
| REQ-AUTH-002 | cap-auth | Invite Management | medium |
| REQ-WF-001 | cap-task-engine | Task Workflow Engine | critical |
| REQ-WF-002 | cap-task-engine | DNA Self-Contained Objects | high |
| REQ-A2A-001 | cap-agent-protocol | Agent Monitor Protocol | critical |
| REQ-A2A-002 | cap-agent-protocol | Agent Recovery | high |
| REQ-INFRA-001 | cap-foundation | Database and Server | critical |
| REQ-INFRA-002 | cap-foundation | Deployment Pipeline | medium |
| REQ-QA-001 | cap-quality | Quality Gates | high |
| REQ-GRAPH-001 | cap-graph | Document as Graph Node | high |
| REQ-GRAPH-002 | cap-graph | Hierarchy Navigation | high |
| REQ-VIZ-001 | cap-viz | Dashboard Visualization | high |
| REQ-VIZ-002 | cap-viz | Hierarchy Drill-Down | high |
| REQ-PROV-001 | cap-provenance | Contribution Tracking | medium |
| REQ-TOKEN-001 | cap-token | Value Attribution | low |

### Migration: `049-populate-requirements.sql`

```sql
-- Populate requirements from PLATFORM-001 v0.0.6
-- FK deps: project_slug='mindspace' (migration 046), created_by='system' (migration 046)
-- capability_id FK to capabilities (migrations 038 + 048)
-- Idempotent: INSERT OR IGNORE (UNIQUE on project_slug + req_id_human)

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES
  ('req-auth-001', 'mindspace', 'REQ-AUTH-001', 'User Login', 'Users can register, login, and manage sessions via JWT', 'active', 'high', 'system', 'cap-auth'),
  ('req-auth-002', 'mindspace', 'REQ-AUTH-002', 'Invite Management', 'Project owners can invite users, manage access control', 'active', 'medium', 'system', 'cap-auth'),
  ('req-wf-001', 'mindspace', 'REQ-WF-001', 'Task Workflow Engine', 'State machine with role-based transitions, gates, and validation', 'active', 'critical', 'system', 'cap-task-engine'),
  ('req-wf-002', 'mindspace', 'REQ-WF-002', 'DNA Self-Contained Objects', 'Task DNA holds all context — no external links required', 'active', 'high', 'system', 'cap-task-engine'),
  ('req-a2a-001', 'mindspace', 'REQ-A2A-001', 'Agent Monitor Protocol', 'Agents wake, recover from memory, monitor for work, execute tasks', 'active', 'critical', 'system', 'cap-agent-protocol'),
  ('req-a2a-002', 'mindspace', 'REQ-A2A-002', 'Agent Recovery', 'Agents recover state from brain after restart or context loss', 'active', 'high', 'system', 'cap-agent-protocol'),
  ('req-infra-001', 'mindspace', 'REQ-INFRA-001', 'Database and Server', 'SQLite with WAL, Express API, migrations, versioning', 'active', 'critical', 'system', 'cap-foundation'),
  ('req-infra-002', 'mindspace', 'REQ-INFRA-002', 'Deployment Pipeline', 'Git-based deployment, develop/main branches, systemd services', 'active', 'medium', 'system', 'cap-foundation'),
  ('req-qa-001', 'mindspace', 'REQ-QA-001', 'Quality Gates', 'Test pass, version bump, PDSA review, liaison approval before merge', 'active', 'high', 'system', 'cap-quality'),
  ('req-graph-001', 'mindspace', 'REQ-GRAPH-001', 'Document as Graph Node', 'Every document (PDSA, task, requirement) is a node in a traversable graph', 'active', 'high', 'system', 'cap-graph'),
  ('req-graph-002', 'mindspace', 'REQ-GRAPH-002', 'Hierarchy Navigation', 'Mission → Capability → Requirement → Task drill-down in graph', 'active', 'high', 'system', 'cap-graph'),
  ('req-viz-001', 'mindspace', 'REQ-VIZ-001', 'Dashboard Visualization', 'Kanban board, status filters, agent activity, project selector', 'active', 'high', 'system', 'cap-viz'),
  ('req-viz-002', 'mindspace', 'REQ-VIZ-002', 'Hierarchy Drill-Down', 'Click-through from missions to capabilities to requirements to tasks', 'active', 'high', 'system', 'cap-viz'),
  ('req-prov-001', 'mindspace', 'REQ-PROV-001', 'Contribution Tracking', 'Track who created, modified, reviewed each artifact', 'active', 'medium', 'system', 'cap-provenance'),
  ('req-token-001', 'mindspace', 'REQ-TOKEN-001', 'Value Attribution', 'Measure and attribute value of contributions to collaborators', 'active', 'low', 'system', 'cap-token');
```

## Do

DEV creates `api/db/migrations/049-populate-requirements.sql`.

## Study

Verify:
- 15 requirements exist in DB
- Each of the 9 PLATFORM-001 capabilities has at least 1 requirement
- All FKs valid: project_slug='mindspace', created_by='system', capability_id exists
- INSERT OR IGNORE idempotent
- `capability_requirements` junction table NOT needed (using direct `capability_id` column)

## Act

### Design Decisions
1. **15 requirements**: At least 1 per capability, 2 for larger capabilities.
2. **Direct capability_id**: Uses the column added in migration 045, not the junction table.
3. **project_slug = mindspace**: All requirements belong to the mindspace project.
4. **created_by = system**: System user created bootstrap data.
5. **ID format**: `req-{prefix}-{number}`, matches req_id_human lowercase.
