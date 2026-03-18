-- Enrich capability descriptions for knowledge space display
-- 2-3 sentence descriptions matching what an agent would present when suggesting reuse

UPDATE capabilities SET description = 'Authentication and authorization service. Handles user login via email/password and Google OAuth, registration with invite codes, JWT session management, and role-based access control. Protects all API routes and provides identity context for every operation.'
WHERE id = 'cap-auth';

UPDATE capabilities SET description = 'Task workflow engine implementing a validated state machine. Manages the full lifecycle of work items from creation through PDSA review to completion, with role-based transitions, quality gates, and DNA (task metadata) at every step. Enforces the PDSA methodology across all agent work.'
WHERE id = 'cap-task-engine';

UPDATE capabilities SET description = 'Agent-to-agent communication and lifecycle protocol. Enables agents to wake up, recover state from shared memory, discover work via monitors, and collaborate without direct communication. Provides session continuity across context window compactions and handoffs.'
WHERE id = 'cap-agent-protocol';

UPDATE capabilities SET description = 'Core infrastructure foundation. Provides SQLite database with WAL mode, Express API server with middleware chain, systemd service deployment, git-based versioning with atomic commits, and nvm-managed Node.js runtime. Everything else builds on this layer.'
WHERE id = 'cap-foundation';

UPDATE capabilities SET description = 'Quality assurance and governance framework. Enforces TDD test gates before implementation, PDSA review cycles for design validation, liaison approval for human oversight, and version bump requirements for traceability. Tests ARE the specification — implementation follows.'
WHERE id = 'cap-quality';

UPDATE capabilities SET description = 'Traversable context graph connecting every artifact in the hierarchy. Enables navigation from mission purpose down to individual tasks, and from task detail up to strategic intent. Every document, design, and decision is a traversable node with typed relationships.'
WHERE id = 'cap-graph';

UPDATE capabilities SET description = 'Real-time dashboard visualization for the Mindspace platform. Provides mission overview with health indicators, capability drill-down with progress bars, agent activity monitoring, and task status tracking. Serves as the primary human interface for system oversight.'
WHERE id = 'cap-viz';

UPDATE capabilities SET description = 'Authorship and contribution tracking for fair attribution. Records who contributed what — both human and agent — with timestamps, decision provenance, and audit trails. Enables transparent credit assignment and accountability across collaborative work.'
WHERE id = 'cap-provenance';

UPDATE capabilities SET description = 'Token economics for fair value distribution. Measures contributions across the platform and aligns incentives through token-based rewards. Ensures that collaborative outcomes are valued and distributed proportionally to meaningful participation.'
WHERE id = 'cap-token';
