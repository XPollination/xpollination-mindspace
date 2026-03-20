-- Enrich all 15 requirements with 9-section RequirementInterface v1.0 template
-- Sections: Statement, Rationale, Scope, Acceptance Criteria, Behavior, Constraints, Dependencies, Verification, Impact

UPDATE requirements SET content_md = '## Statement
Users authenticate via email/password with JWT session management, protected routes, and cookie persistence.

## Rationale
Authentication is the foundation for all access control. Without identity, no attribution, no authorization, no audit trail.

## Scope
Login page, password validation, JWT generation, session cookie (ms_session), protected API middleware.

## Acceptance Criteria
- User can login with email/password and receive JWT
- Protected routes reject unauthenticated requests with 401
- Session persists across page refreshes via cookie

## Behavior
Given a registered user, When they submit valid credentials, Then a JWT is issued and stored in httpOnly cookie.
Given an unauthenticated request, When accessing a protected route, Then 401 is returned.

## Constraints
JWT secret must be server-side only. Cookies must be httpOnly and sameSite strict.

## Dependencies
Users table with password_hash column. bcrypt for password hashing.

## Verification
Integration tests with supertest. Manual browser test for cookie persistence.

## Impact
Breaking change if JWT format changes — all active sessions invalidated.', content_version = 2 WHERE id = 'req-auth-001';

UPDATE requirements SET content_md = '## Statement
Admins invite users via email with invite codes, role assignment, and expiry management.

## Rationale
Invite-only registration prevents unauthorized access during bootstrapping phase.

## Scope
Invite code generation, email delivery (future), registration with code, role assignment on first login.

## Acceptance Criteria
- Admin can generate invite codes with role and expiry
- User registers with valid invite code
- Expired codes are rejected

## Behavior
Given an admin, When they create an invite, Then a unique code is generated with expiry.
Given a user with invite code, When they register, Then account is created with assigned role.

## Constraints
Invite codes are single-use. Expiry is mandatory.

## Dependencies
REQ-AUTH-001 (login must work first). users and invites tables.

## Verification
Unit tests for invite CRUD. Integration test for registration flow.

## Impact
Low — additive feature, does not change existing auth flow.', content_version = 2 WHERE id = 'req-auth-002';

UPDATE requirements SET content_md = '## Statement
Tasks follow a validated state machine with role-based transitions, DNA gates, and quality enforcement.

## Rationale
Without enforced workflow, agents skip steps, bypass reviews, and produce untracked work. The state machine makes the correct path the only path.

## Scope
Status transitions (pending→ready→active→review→complete), role enforcement, DNA completeness gates.

## Acceptance Criteria
- Only valid transitions are accepted (whitelist)
- Role must match for role-specific transitions
- DNA gates block transitions when required fields are missing

## Behavior
Given a task in ready status assigned to dev, When dev transitions to active, Then the transition succeeds.
Given a task in ready status assigned to dev, When pdsa tries to transition to active, Then the transition is rejected.

## Constraints
All transitions must be atomic (database transaction). No bypass mechanism.

## Dependencies
mindspace_nodes table. workflow-engine.js module.

## Verification
Unit tests for each transition. Integration tests with interface-cli.js.

## Impact
High — changes to transition rules affect all agents and the entire pipeline.', content_version = 2 WHERE id = 'req-wf-001';

UPDATE requirements SET content_md = '## Statement
Only the assigned role can advance a task. Cross-role transitions are blocked by the workflow engine.

## Rationale
Role enforcement prevents one agent from doing another''s work, maintaining separation of concerns.

## Scope
Role check in validateTransition, role-specific transition variants (ready->active:dev vs ready->active:pdsa).

## Acceptance Criteria
- DEV can only claim dev-assigned tasks
- PDSA cannot implement code tasks
- QA cannot fix implementation bugs

## Behavior
Given a dev task in ready, When dev claims it, Then transition succeeds with role preserved.
Given a pdsa task in ready, When dev tries to claim, Then transition is rejected with role mismatch error.

## Constraints
Role is stored in DNA, not as a column. Must parse dna_json for role check.

## Dependencies
REQ-WF-001 (base workflow engine).

## Verification
Unit tests for role enforcement per transition type.

## Impact
Medium — role changes require careful migration of in-flight tasks.', content_version = 2 WHERE id = 'req-wf-002';

UPDATE requirements SET content_md = '## Statement
Agents wake up, recover state from shared brain memory, discover work via monitors, and follow PDSA methodology.

## Rationale
Agents lose all context on restart. Without recovery protocol, every session starts from zero.

## Scope
Monitor skill (/xpo.claude.monitor), brain queries for recovery, --wait polling for work, session handoff.

## Acceptance Criteria
- Agent recovers role, task state, and learnings from brain on wake
- Monitor detects actionable work within 30 seconds
- Agent contributes key learnings before session end

## Behavior
Given a fresh agent session, When /xpo.claude.monitor {role} runs, Then agent identity is set and brain is queried.
Given no actionable work, When --wait polls, Then it blocks until work appears.

## Constraints
Brain API must be available. If down, fallback to CLAUDE.md and PM system scan.

## Dependencies
Brain API (Qdrant + Fastify). agent-monitor.cjs script. CLAUDE.md files.

## Verification
Integration test: wake agent, verify brain query, verify monitor detects work.

## Impact
High — changes to recovery protocol affect all 4 agent roles.', content_version = 2 WHERE id = 'req-a2a-001';

UPDATE requirements SET content_md = '## Statement
Agents communicate exclusively via PM system DNA. No direct messaging between agents.

## Rationale
Direct messaging creates invisible dependencies and race conditions. DNA is the single source of truth.

## Scope
Task DNA as communication channel, transition markers in brain, no tmux send-keys for content.

## Acceptance Criteria
- All task context is in DNA (self-contained)
- Any agent can pick up any task from DNA alone
- No agent-to-agent direct communication

## Behavior
Given a task in review, When QA reads the DNA, Then all implementation details are present without needing to ask DEV.
Given a new agent session, When it reads task DNA, Then it has full context to continue work.

## Constraints
DNA must be self-contained. No "see PDSA doc at..." without embedding content.

## Dependencies
REQ-A2A-001 (agent lifecycle). interface-cli.js update-dna command.

## Verification
Review DNA completeness after each task. Verify new agent can pick up mid-flight task.

## Impact
Low — reinforces existing practice, does not change implementation.', content_version = 2 WHERE id = 'req-a2a-002';

UPDATE requirements SET content_md = '## Statement
SQLite database with WAL mode, Express API server, systemd deployment, sequential migrations with checksums.

## Rationale
Infrastructure must be simple, reliable, and recoverable. SQLite eliminates DB server dependency.

## Scope
Database setup, WAL mode, migration system, Express server, systemd service files, nvm-managed Node.js.

## Acceptance Criteria
- Database uses WAL mode for concurrent read access
- Migrations run sequentially with checksum verification
- API server starts via systemd and survives restarts

## Behavior
Given a new migration file, When API starts, Then migration is applied and recorded in migrations table.
Given a modified migration, When API starts, Then checksum mismatch throws error.

## Constraints
No sudo access. SQLite only (no PostgreSQL/MySQL). Node.js via nvm.

## Dependencies
Hetzner CX22 server. Ubuntu 24.04. nvm for Node.js 22.

## Verification
Migration tests. Service health check. Database integrity check.

## Impact
High — infrastructure changes affect all services.', content_version = 2 WHERE id = 'req-infra-001';

UPDATE requirements SET content_md = '## Statement
Git-based versioning with atomic commits, specific file staging, feature branches, and PR workflow.

## Rationale
Atomic commits enable precise rollback. Feature branches isolate risk. PRs enable review.

## Scope
Git protocol (no git add .), branch naming, PR workflow, tag-based releases.

## Acceptance Criteria
- All commits stage specific files only
- Feature branches for multi-task work
- PRs for main branch changes

## Behavior
Given a code change, When agent commits, Then only the specific changed file is staged.
Given a feature complete, When merged to develop, Then PR is created for main.

## Constraints
Never force push. Never amend published commits. Ask before destructive operations.

## Dependencies
GitHub repository. Branch protection rules.

## Verification
Git hooks for commit message format. PR review process.

## Impact
Low — git protocol is additive, does not break existing workflow.', content_version = 2 WHERE id = 'req-infra-002';

UPDATE requirements SET content_md = '## Statement
All tasks pass TDD tests, PDSA review, liaison approval, and version bump requirements before completion.

## Rationale
Quality gates prevent broken code from reaching production. Tests ARE the specification.

## Scope
Layer 1 (pre-merge): test pass, version bump. Layer 2 (workflow): DNA gates. Layer 3 (post-complete): brain gardening.

## Acceptance Criteria
- No task completes without passing tests
- PDSA review required for design tasks
- Liaison approval required for human-facing changes

## Behavior
Given a task with failing tests, When dev tries to submit for review, Then transition is allowed but QA will catch failures.
Given a task without PDSA ref, When transitioning to active:dev, Then transition is blocked.

## Constraints
Tests must run in CI or manually. Version bump is DNA field check, not semver enforcement.

## Dependencies
vitest test framework. workflow-engine.js gates. interface-cli.js transition validation.

## Verification
Gate enforcement tests. Manual verification of review chain.

## Impact
Medium — new gates may block existing incomplete tasks.', content_version = 2 WHERE id = 'req-qa-001';

UPDATE requirements SET content_md = '## Statement
Every artifact is a traversable graph node with typed relationships enabling navigation from mission to task and back.

## Rationale
Context recovery requires traversal. An agent asked about a port must be able to trace to the architecture decision.

## Scope
Graph structure (Mission→Capability→Requirement→Task), node types, relationship types, traversal queries.

## Acceptance Criteria
- All hierarchy levels are connected via FK relationships
- Traversal queries return complete path from any node
- Both top-down and bottom-up traversal work

## Behavior
Given a task node, When traversing up, Then requirement→capability→mission path is returned.
Given a mission node, When traversing down, Then all capabilities and their requirements are listed.

## Constraints
Single mission_id FK on capabilities (no many-to-many yet). requirement_refs in DNA JSON.

## Dependencies
Missions, capabilities, requirements tables. mindspace_nodes for tasks.

## Verification
Integration tests with JOIN queries. Viz hierarchy drilldown test.

## Impact
High — graph structure is the foundation for the knowledge browser.', content_version = 2 WHERE id = 'req-graph-001';

UPDATE requirements SET content_md = '## Statement
Users navigate mission to capability to requirement to task with progressive drill-down and breadcrumb.

## Rationale
Progressive disclosure prevents information overload. Breadcrumbs prevent users from getting lost.

## Scope
Mission cards, capability cards, requirement list, task list, breadcrumb navigation, health colors.

## Acceptance Criteria
- Click mission shows its capabilities
- Click capability shows its requirements and tasks
- Breadcrumb shows full path and is clickable

## Behavior
Given the mission overview, When user clicks a mission, Then capability cards for that mission are shown.
Given a capability view, When user clicks breadcrumb, Then navigation returns to mission level.

## Constraints
Must work on mobile (responsive). Dark and light themes supported.

## Dependencies
REQ-GRAPH-001 (graph structure). Mission-overview API endpoint.

## Verification
Automated tests for API responses. Manual browser testing by Thomas.

## Impact
Medium — UI changes are versioned, rollback is instant via symlink.', content_version = 2 WHERE id = 'req-graph-002';

UPDATE requirements SET content_md = '## Statement
Real-time dashboard with task status, agent activity, mission overview, and progressive hierarchy disclosure.

## Rationale
Thomas needs a single view to see system state: what''s happening, what''s stuck, what''s done.

## Scope
Kanban board, mission overview, hierarchy drilldown, agent bars, status badges, polling.

## Acceptance Criteria
- Dashboard updates every 10 seconds
- Task cards show status, role, and title
- Mission overview shows health colors

## Behavior
Given a running system, When dashboard loads, Then current task states are shown.
Given a task status change, When next poll fires, Then dashboard reflects the change.

## Constraints
No WebSocket — HTTP polling only. Must work behind nginx proxy.

## Dependencies
REQ-GRAPH-002 (hierarchy navigation). viz/server.js API endpoints.

## Verification
Automated API response tests. Manual visual verification.

## Impact
Low — dashboard is read-only, changes don''t affect backend.', content_version = 2 WHERE id = 'req-viz-001';

UPDATE requirements SET content_md = '## Statement
Agent monitoring with prompt detection, health indicators, and work progress in the dashboard.

## Rationale
Agents get stuck on prompts. Without monitoring, stuck agents waste hours.

## Scope
Agent status bars, prompt detection, health signals (idle/active/prompt), context percentage.

## Acceptance Criteria
- Each agent shows current status (idle, active, prompt)
- Prompt detection triggers visual indicator
- Context percentage shown when available

## Behavior
Given an agent with a pending prompt, When monitor runs, Then PROMPT DETECTED indicator appears.
Given an idle agent, When no work in queue, Then idle indicator shown.

## Constraints
Monitoring via tmux capture-pane — indirect observation only.

## Dependencies
REQ-VIZ-001 (base dashboard). agent-monitor.cjs script.

## Verification
Monitor script tests. Manual verification of prompt detection.

## Impact
Low — monitoring is read-only.', content_version = 2 WHERE id = 'req-viz-002';

UPDATE requirements SET content_md = '## Statement
Track contributions with timestamps and decision provenance for fair attribution across human and agent work.

## Rationale
Without provenance, token distribution is guesswork. Every contribution must be recorded.

## Scope
Contribution records, decision provenance, audit trail, brain memory as provenance store.

## Acceptance Criteria
- Every task transition records actor and timestamp
- Brain stores contribution markers with context
- Audit trail is append-only

## Behavior
Given a task completion, When transition executes, Then brain marker records actor, slug, and outcome.
Given a review decision, When liaison approves, Then reasoning is stored in DNA.

## Constraints
Append-only — no editing or deleting provenance records.

## Dependencies
Brain API. interface-cli.js transition markers. DNA fields.

## Verification
Brain query for contribution markers. DNA inspection for review fields.

## Impact
Medium — provenance format changes require migration of existing records.', content_version = 2 WHERE id = 'req-prov-001';

UPDATE requirements SET content_md = '## Statement
Token distribution based on measured contributions with transparent formula and automated measurement.

## Rationale
Fair value distribution requires objective measurement, not subjective assessment.

## Scope
Contribution measurement, distribution formula, token ledger, payout reports.

## Acceptance Criteria
- Contributions are measured automatically via provenance chain
- Distribution formula is documented and auditable
- Token balances are queryable

## Behavior
Given completed work by multiple contributors, When distribution runs, Then tokens are allocated proportionally.
Given a payout request, When balance is queried, Then accurate token count is returned.

## Constraints
Local-first — tokens work within platform before external integration. No blockchain dependency.

## Dependencies
REQ-PROV-001 (provenance chain). Contribution measurement API.

## Verification
Unit tests for distribution formula. Integration test for end-to-end flow.

## Impact
High — formula changes affect all participants'' compensation.', content_version = 2 WHERE id = 'req-token-001';
