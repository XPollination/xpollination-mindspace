-- Populate 15 requirements across 9 PLATFORM-001 capabilities
-- Requirements are the HOW — what users/agents will do
-- FK deps: project_slug=mindspace (046), created_by=system (046), capability_id (045)
-- Idempotent: INSERT OR IGNORE

-- CAP-AUTH: Authentication (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-auth-001', 'mindspace', 'REQ-AUTH-001', 'User Login',
        'Users can authenticate via email/password with JWT session management',
        'active', 'high', 'system', 'cap-auth');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-auth-002', 'mindspace', 'REQ-AUTH-002', 'Invite Management',
        'Admins can invite users via email with role-based access control',
        'active', 'medium', 'system', 'cap-auth');

-- CAP-TASK-ENGINE: Workflow (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-wf-001', 'mindspace', 'REQ-WF-001', 'Task Workflow',
        'Tasks follow a state machine with validated transitions, gates, and DNA',
        'active', 'critical', 'system', 'cap-task-engine');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-wf-002', 'mindspace', 'REQ-WF-002', 'Role-Based Transitions',
        'Transitions enforce role ownership — only assigned role can advance a task',
        'active', 'high', 'system', 'cap-task-engine');

-- CAP-AGENT-PROTOCOL: A2A Communication (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-a2a-001', 'mindspace', 'REQ-A2A-001', 'Agent Protocol',
        'Agents recover state from memory, monitor for work, and follow PDSA methodology',
        'active', 'critical', 'system', 'cap-agent-protocol');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-a2a-002', 'mindspace', 'REQ-A2A-002', 'Agent Communication',
        'Agents communicate exclusively via PM system DNA — no direct agent-to-agent messaging',
        'active', 'high', 'system', 'cap-agent-protocol');

-- CAP-FOUNDATION: Infrastructure (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-infra-001', 'mindspace', 'REQ-INFRA-001', 'Infrastructure',
        'SQLite database with WAL mode, Express API server, systemd deployment',
        'active', 'critical', 'system', 'cap-foundation');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-infra-002', 'mindspace', 'REQ-INFRA-002', 'Version Management',
        'Git-based versioning with atomic commits, feature branches, and PR workflow',
        'active', 'medium', 'system', 'cap-foundation');

-- CAP-QUALITY: QA and Governance (1 requirement)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-qa-001', 'mindspace', 'REQ-QA-001', 'Quality Gates',
        'All tasks pass TDD tests, version bumps, PDSA review, and liaison approval before completion',
        'active', 'high', 'system', 'cap-quality');

-- CAP-GRAPH: Traversable Context (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-graph-001', 'mindspace', 'REQ-GRAPH-001', 'Document as Graph Node',
        'Every design document, task, and artifact is a traversable node in the hierarchy',
        'active', 'high', 'system', 'cap-graph');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-graph-002', 'mindspace', 'REQ-GRAPH-002', 'Hierarchy Navigation',
        'Users can navigate mission > capability > requirement > task with drill-down',
        'active', 'high', 'system', 'cap-graph');

-- CAP-VIZ: Dashboard (2 requirements)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-viz-001', 'mindspace', 'REQ-VIZ-001', 'Dashboard Visualization',
        'Real-time dashboard showing task status, agent activity, and hierarchy overview',
        'active', 'high', 'system', 'cap-viz');

INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-viz-002', 'mindspace', 'REQ-VIZ-002', 'Agent Monitoring',
        'Visual monitoring of agent states, prompt confirmations, and work progress',
        'active', 'high', 'system', 'cap-viz');

-- CAP-PROVENANCE: Authorship Tracking (1 requirement)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-prov-001', 'mindspace', 'REQ-PROV-001', 'Authorship Tracking',
        'Track who contributed what — human and agent contributions recorded with provenance',
        'active', 'medium', 'system', 'cap-provenance');

-- CAP-TOKEN: Token Economics (1 requirement)
INSERT OR IGNORE INTO requirements (id, project_slug, req_id_human, title, description, status, priority, created_by, capability_id)
VALUES ('req-token-001', 'mindspace', 'REQ-TOKEN-001', 'Token Economics',
        'Fair value distribution based on measured contributions and collaborative outcomes',
        'active', 'low', 'system', 'cap-token');
