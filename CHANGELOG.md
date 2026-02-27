# Changelog

All notable changes documented here.
Updated with every version — mandatory before version seal.

---

## [v0.0.1] — 2026-01-28 (Active)

### Added
- MCP server with content pipeline tools (crawl_trends, propose_topic, write_draft, fact_check, improve_draft, publish_post)
- SQLite database with frames, drafts, trends, workflow_state tables
- RSS parser and trend matcher services
- Git publisher service for Hugo integration
- Frame and Draft repositories
- PM tool: mindspace_nodes table with DAG support, DNA validation
- Workflow engine with role-based transition whitelist (WORKFLOW.md v12 → v13)
- Agent monitor (agent-monitor.cjs) with --wait mode for event-driven work detection
- Interface CLI (interface-cli.js) for regulated database access
- Brain-gated transitions: health check before DB changes, synchronous marker contribution
- Blocked state as PAUSE+RESUME meta-state (stores/restores exact previous state+role)
- Visualization dashboard (viz/) with warehouse layout, live updates, multi-project support
- All Projects dropdown in viz for cross-project view

### Changed
- WORKFLOW.md v13: added Blocked State meta-state section
- Workflow engine: any->blocked allows all agents, blocked->restore for liaison/system
- Agent monitor: role-based monitoring (not status enumeration)
