# PDSA: Missions Seed — Mindspace Project Hierarchy

**Task:** ms-missions-seed
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.17 Phase 4

## Problem

DB schema exists (missions, capabilities, requirements tables) but no data seeded. 321+ tasks are flat — no hierarchy. Need to seed the Mindspace project structure so the hierarchy view works.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Seed script creates Mindspace as a Mission with 10 Capabilities | Matches existing feature/cap-* branch scaffolding |
| D2 | 10 Capabilities: FOUNDATION, AUTH, TASK-ENGINE, AGENT-PROTOCOL, ORG-BRAIN, QUALITY, INTEGRATION, REQUIREMENTS, MARKETPLACE, RELEASE | Covers all project domains |
| D3 | Map existing REQ-* requirements to capabilities | Requirements already exist, need linking |
| D4 | Map existing tasks to requirements where possible | Creates traversable graph macro→micro |
| D5 | INSERT OR IGNORE for idempotency | Safe to run multiple times |
| D6 | Seed script at api/db/seed-missions.ts or similar | Consistent with existing seed patterns |

### Acceptance Criteria

- AC1: Mindspace mission exists in missions table
- AC2: 10 capabilities linked to Mindspace mission
- AC3: Existing requirements mapped to capabilities
- AC4: Tasks mapped to requirements where applicable
- AC5: Viz hierarchy view shows Mission > Capability > Requirement > Task
- AC6: Seed is idempotent

### Test Plan

1. Run seed script → verify data in DB
2. Open Viz mission overview → hierarchy visible
3. Run seed again → no duplicates

## Do / Study / Act

(To be completed)
