# Changelog: h1-8-agent-welcome-capability v0.0.1

## v0.0.1 — 2026-03-12

Initial implementation.

### Changes
- New welcome-context.ts service: buildWelcomeContext(projectSlug, role)
- Queries active mission, computes per-capability progress from capability_tasks links
- Counts pending tasks for connecting agent role
- Integrated into agent-pool.ts connect endpoint (WELCOME response includes context)

### Tests
- 3/3 passing (api/__tests__/h1-8-agent-welcome-capability.test.ts)
