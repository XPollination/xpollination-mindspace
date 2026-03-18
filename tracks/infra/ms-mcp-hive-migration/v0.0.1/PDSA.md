# PDSA: Migrate MCP to Hive + Multi-User Support

**Task:** ms-mcp-hive-migration | **Version:** v0.0.1 | **Status:** PLAN

## Problem
MCP proxied via bestpractice (deprecated), hardcodes Thomas agent_id. Need hive URL + multi-user.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add /mcp to hive nginx config (proxy to 127.0.0.1:3201) | Hive is the agent entry point |
| D2 | Resolve agent_id from API key per request | Multi-user support |
| D3 | Keep bestpractice/mcp as redirect for backward compat | No breaking change |
| D4 | Update ONBOARD-001 docs with new URL | Documentation |

### Acceptance Criteria
- AC1: hive.xpollination.earth/mcp responds to MCP initialize
- AC2: agent_id resolved from API key, not hardcoded
- AC3: bestpractice redirects to hive
- AC4: Documentation updated

### Files: hive nginx config, brain-mcp.ts (agent_id resolution)
