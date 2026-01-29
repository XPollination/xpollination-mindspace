# Use Case: Agent Development Framework

**Status:** PRIMARY - In Design
**PDCA:** `../pdca/2026-01-29-UTC-1100.01-agentic-development-framework.pdca.md`

---

## Overview

Multi-agent software development orchestration where AI agents collaborate to develop software autonomously with human-in-the-loop quality gates.

## Flow

```
Human Terminal (Requirements)
      │
      ▼
MCP Server (State)
      │
      ▼
Orchestrator Agent
      │
      ├── Architect Agent
      ├── Coder Agent
      ├── Tester Agent
      └── Reviewer Agent
            │
            ▼
      Quality Gate → Loop or Return to Human
```

## Key Principles

1. **OOP Mandatory** - All code follows object-oriented patterns
2. **Single Method Returns** - Coder produces small, testable units
3. **GIVEN/WHEN/THEN** - Acceptance criteria format
4. **Test-First** - Tests drive implementation
5. **Human Approval** - Final gate before delivery

## MCP Tools (Planned)

- `define_spec` - Create specification with acceptance criteria
- `execute_development_task` - Hand off to orchestrator
- `get_development_status` - Monitor progress
- `approve_delivery` - Human approval gate

## Agent Roles

| Role | Input | Output |
|------|-------|--------|
| Orchestrator | Spec + criteria | Task coordination |
| Architect | Requirements | Interface contracts |
| Coder | Interfaces | Method implementations |
| Tester | Code + criteria | Test results |
| Reviewer | Code + tests | Approval/feedback |

---

**See full PDCA for detailed design.**
