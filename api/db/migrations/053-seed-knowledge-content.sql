-- Seed knowledge content: decompose PLATFORM-001 v0.0.7 into per-node markdown
-- Each level owns its depth: Mission=WHY, Capability=WHAT, Requirement=HOW
-- Source: PLATFORM-001 v0.0.7 document.md (1035 lines, 11 parts)

-- === MISSIONS (WHY) ===

UPDATE missions SET content_md = '## Fair Attribution

Every contribution — human or agent — must be measurable and fairly valued.

### Strategic Intent
Fair Attribution exists because collaborative work fails when contributions are invisible. In a system where agents and humans work together, the provenance chain must track who did what, when, and why — not as bureaucracy, but as the foundation for fair value distribution.

### How It Composes
This mission uses three capabilities as services:
- **CAP-AUTH** — identity is the prerequisite for attribution
- **CAP-PROVENANCE** — the 6-step provenance chain tracks every contribution
- **CAP-TOKEN** — token economics distributes value based on measured contributions

### What Success Looks Like
When a task completes, every contributor (human prompts, agent implementations, QA reviews) is recorded with timestamps and decision provenance. The token system can then distribute value proportionally to meaningful participation.',
content_version = 1 WHERE id = 'mission-fair-attribution';

UPDATE missions SET content_md = '## Traversable Context

Decision context must be available at every level — from mission purpose to individual task.

### Strategic Intent
On 2026-03-17, agents caused chaos because they lacked the ability to zoom out. Three wrong assumptions in one conversation — each caused by the inability to traverse from task level to the governing architecture decision. The traversable graph is not a visualization feature — it is the mechanism by which agents maintain context across the full depth of the system.

### Architecture
```
Project → Mission (WHY) → Capability (WHAT) → Requirement (HOW) → Task (WORK)
```

Two traversal paths:
- **Organizational** (top-down): "Where does this work live? Why are we doing it?"
- **Service-centric** (bottom-up): "What is the impact of changing this?"

### How It Composes
- **CAP-TASK-ENGINE** — the workflow state machine that manages task lifecycle
- **CAP-GRAPH** — the hierarchy navigation connecting every node
- **CAP-VIZ** — the dashboard that renders the graph for humans',
content_version = 1 WHERE id = 'mission-traversable-context';

UPDATE missions SET content_md = '## Agent-Human Collaboration

Agents and humans work together without chaos, following a structured methodology.

### Strategic Intent
The PDSA (Plan-Do-Study-Act) methodology ensures every piece of work is planned, implemented, reviewed, and improved. Hard gates make the correct path the only path — there is no way to bypass quality checks, skip reviews, or merge without tests passing. This is CMM Level 4: process is measured and controlled.

### Workflow Lifecycle
```
pending → ready → active → review → complete
                    ↓         ↓
                  blocked   rework ↺
```

### Role Definitions
- **LIAISON** — bridge between human and agents, creates tasks, presents work for approval
- **PDSA** — plans, researches, designs; produces PDSA documents; never implements
- **DEV** — implements what PDSA designed; never changes tests; never plans
- **QA** — writes tests from designs, reviews implementations; never fixes code

### How It Composes
- **CAP-AUTH** — shared with Fair Attribution, provides identity context
- **CAP-AGENT-PROTOCOL** — agent lifecycle: wake, recover, work, handoff
- **CAP-QUALITY** — hard gates: TDD, PDSA review, liaison approval, version bumps
- **CAP-FOUNDATION** — infrastructure everything runs on',
content_version = 1 WHERE id = 'mission-agent-human-collab';

-- === CAPABILITIES (WHAT) ===

UPDATE capabilities SET content_md = '## CAP-AUTH: Authentication & Authorization

Handles user login via email/password and Google OAuth, registration with invite codes, JWT session management, and role-based access control. Protects all API routes and provides identity context for every operation.

### API Key Format
API keys follow the format `ms_<base64>` with SHA-256 hashing for storage. Combined middleware checks JWT cookies first, then API key headers — supporting both browser sessions and agent access.

### Actor Summary
| Actor | Auth Method | Permissions |
|-------|------------|-------------|
| Human (browser) | JWT cookie via login/OAuth | Full UI access |
| Agent (CLI) | API key in header | Task operations only |
| A2A Server | Service token | Cross-project coordination |',
content_version = 1 WHERE id = 'cap-auth';

UPDATE capabilities SET content_md = '## CAP-TASK-ENGINE: Workflow Engine

Task workflow engine implementing a validated state machine. Every task carries DNA — a self-contained context object with title, description, acceptance criteria, findings, implementation details, and review history.

### DNA Field Categories
- **Identity**: slug, title, type, group
- **Lifecycle**: status, role, priority, depends_on
- **Content**: description, acceptance_criteria, proposed_design
- **History**: findings, implementation, qa_review, pdsa_review
- **Gates**: memory_query_session, memory_contribution_id, pdsa_ref

### Quality Gates
Every transition is validated: role-based ownership, DNA completeness checks, version bump requirements, brain contribution gates. The engine enforces the process — no bypass possible.

### Context Degradation Chain
When context pressure builds: agent compacts → loses nuance → makes assumptions → produces lower quality → requires rework. The engine counters this by making DNA self-contained — any agent can pick up any task from DNA alone.',
content_version = 1 WHERE id = 'cap-task-engine';

UPDATE capabilities SET content_md = '## CAP-AGENT-PROTOCOL: A2A Communication

Agent lifecycle protocol: wake up, recover state from shared memory, discover work via monitors, and collaborate without direct communication.

### Agent Lifecycle
1. **Wake** — `/xpo.claude.monitor {role}` sets identity and queries brain
2. **Recover** — brain returns role definition, current task state, operational learnings
3. **Work** — `--wait` blocks until actionable task arrives, agent claims and implements
4. **Handoff** — contribute key learnings to brain before session end

### What Agents Can Do
- Read/write files in their project
- Execute git operations (atomic commits, specific file staging)
- Query and contribute to shared brain memory
- Transition tasks through workflow states

### What Agents Cannot Do
- Communicate directly with other agents (PM system only)
- Bypass quality gates or skip transitions
- Access systems outside their project scope',
content_version = 1 WHERE id = 'cap-agent-protocol';

UPDATE capabilities SET content_md = '## CAP-FOUNDATION: Core Infrastructure

SQLite database with WAL mode, Express API server with middleware chain, systemd service deployment, git-based versioning with atomic commits, and nvm-managed Node.js runtime.

### Stack
- **Runtime**: Node.js 22.x via nvm
- **Database**: SQLite 3 with WAL mode, better-sqlite3 bindings
- **API**: Express 5 with typed routes
- **Deployment**: systemd services on Hetzner CX22 (2 vCPU, 8GB RAM)
- **VCS**: Git with branch protection, PR workflow

### Migration System
Sequential SQL migrations tracked in `migrations` table with SHA-256 checksums. Checksum mismatch on applied migration throws error — prevents silent schema drift.',
content_version = 1 WHERE id = 'cap-foundation';

UPDATE capabilities SET content_md = '## CAP-QUALITY: QA & Governance

Enforces TDD test gates before implementation, PDSA review cycles for design validation, liaison approval for human oversight, and version bump requirements for traceability.

### Hard Gates (Layer 1, 2, 3)
- **Layer 1** (pre-merge): Tests must pass, version must bump, PDSA doc must exist
- **Layer 2** (workflow): Role-based transitions, DNA completeness checks, brain contribution gates
- **Layer 3** (post-completion): Micro-gardening consolidates task learnings in brain

### Principle
Tests ARE the specification. QA writes failing tests first (TDD). DEV implements to make them pass. If tests fail after implementation, DEV fixes implementation — never the tests.',
content_version = 1 WHERE id = 'cap-quality';

UPDATE capabilities SET content_md = '## CAP-GRAPH: Traversable Context Graph

Hierarchy navigation connecting every artifact: Mission → Capability → Requirement → Task. Every document, design, and decision is a traversable node with typed relationships.

### What the Graph Solves
1. **Context recovery** — agents traverse up from task to mission to understand WHY
2. **Impact analysis** — traverse down from capability to see all affected tasks
3. **Reuse discovery** — capabilities shared across missions are visible in the graph
4. **Decision provenance** — every decision links to its governing requirement

### Implementation
- Missions table with slug, description, status
- Capabilities table with mission_id FK
- Requirements table with capability_id FK
- Tasks linked via requirement_refs in DNA JSON',
content_version = 1 WHERE id = 'cap-graph';

UPDATE capabilities SET content_md = '## CAP-VIZ: Dashboard Visualization

Real-time dashboard for the Mindspace platform. Provides mission overview with health indicators, capability drill-down with progress bars, agent activity monitoring, and task status tracking.

### Current Features
- **Kanban board** — task cards grouped by status with drag support
- **Mission overview** — mission cards with aggregate health colors (green/yellow/red)
- **Capability drill-down** — progressive disclosure from mission to capability to requirement to task
- **Agent monitoring** — real-time agent status with prompt detection
- **Settings** — user preferences, API keys, session management

### Versioned UI
Each version is a complete snapshot in `viz/versions/v0.0.X/`. The `viz/active` symlink points to the current version. Rollback is instant: change the symlink.',
content_version = 1 WHERE id = 'cap-viz';

UPDATE capabilities SET content_md = '## CAP-PROVENANCE: Authorship Tracking

Records who contributed what — both human and agent — with timestamps, decision provenance, and audit trails.

### Provenance Chain (6 Steps)
1. Human describes need (prompt recorded)
2. Agent queries brain for matching capabilities
3. Agent designs solution (PDSA document)
4. Agent implements (git commits with author)
5. QA reviews (test results recorded)
6. Liaison approves (human decision recorded)

Each step records: actor, timestamp, artifact reference, and decision rationale. The chain is append-only — history cannot be rewritten.',
content_version = 1 WHERE id = 'cap-provenance';

UPDATE capabilities SET content_md = '## CAP-TOKEN: Token Economics

Measures contributions across the platform and aligns incentives through token-based rewards. Ensures collaborative outcomes are valued and distributed proportionally to meaningful participation.

### Design Principles
- Value flows to those who create it
- Contribution measurement is automated via provenance chain
- Distribution formula is transparent and auditable
- Local-first architecture — tokens work within the platform before external integration',
content_version = 1 WHERE id = 'cap-token';

-- === REQUIREMENTS (HOW) ===

UPDATE requirements SET content_md = 'Users authenticate via email/password with JWT sessions. Login page, password validation, session cookie management, protected route middleware.', content_version = 1 WHERE id = 'req-auth-001';
UPDATE requirements SET content_md = 'Admins invite users via email. Invite codes with expiry, registration flow, role assignment on first login.', content_version = 1 WHERE id = 'req-auth-002';
UPDATE requirements SET content_md = 'Tasks follow validated state machine. Status transitions enforced by workflow engine with role checks and DNA gates.', content_version = 1 WHERE id = 'req-wf-001';
UPDATE requirements SET content_md = 'Only the assigned role can advance a task. DEV claims dev tasks, PDSA claims pdsa tasks. Cross-role transitions blocked.', content_version = 1 WHERE id = 'req-wf-002';
UPDATE requirements SET content_md = 'Agents wake up, recover state from brain, monitor for work, follow PDSA methodology. Session continuity across compactions.', content_version = 1 WHERE id = 'req-a2a-001';
UPDATE requirements SET content_md = 'Agents communicate via PM system DNA only. No direct messaging. Task DNA is self-contained — any agent can pick up any task.', content_version = 1 WHERE id = 'req-a2a-002';
UPDATE requirements SET content_md = 'SQLite with WAL mode, Express API, systemd deployment. Sequential migrations with checksum tracking.', content_version = 1 WHERE id = 'req-infra-001';
UPDATE requirements SET content_md = 'Git atomic commits, specific file staging, feature branches, PR workflow. Version tags as rollback points.', content_version = 1 WHERE id = 'req-infra-002';
UPDATE requirements SET content_md = 'TDD test gates, PDSA review cycles, liaison approval, version bump requirements. Tests are the specification.', content_version = 1 WHERE id = 'req-qa-001';
UPDATE requirements SET content_md = 'Every artifact is a traversable graph node. Documents, designs, decisions linked with typed relationships.', content_version = 1 WHERE id = 'req-graph-001';
UPDATE requirements SET content_md = 'Users navigate mission to capability to requirement to task with drill-down. Breadcrumb shows full path.', content_version = 1 WHERE id = 'req-graph-002';
UPDATE requirements SET content_md = 'Real-time dashboard with task status, agent activity, mission overview. Progressive disclosure at every level.', content_version = 1 WHERE id = 'req-viz-001';
UPDATE requirements SET content_md = 'Agent monitoring with prompt detection, health indicators, and work progress visualization.', content_version = 1 WHERE id = 'req-viz-002';
UPDATE requirements SET content_md = 'Track contributions with timestamps and decision provenance. Append-only audit trail for accountability.', content_version = 1 WHERE id = 'req-prov-001';
UPDATE requirements SET content_md = 'Token distribution based on measured contributions. Transparent formula, automated measurement via provenance.', content_version = 1 WHERE id = 'req-token-001';
