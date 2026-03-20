# PDSA: MCP Tools for Knowledge Browsing + Creation

**Task:** mcp-knowledge-tools-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-A2A-004

## Problem

Agents use interface-cli.js for task operations but cannot browse/create knowledge objects (missions, capabilities, requirements) via MCP. Need 17 MCP tools.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Extend existing MCP server (src/index.ts) | One server, one connection. No separate process needed. |
| D2 | Truncation for large content_md (max 4000 chars) | MCP responses should be concise. Full content available via get_*_content tool. |
| D3 | Auth via xpo_ prefixed API key in MCP config | Consistent with existing brain API auth pattern. |

### 17 MCP Tools

**Read Tools (8):**
1. `list_missions` — List all missions with status, cap count
2. `get_mission` — Get mission by ID/slug with capabilities
3. `list_capabilities` — List capabilities for a mission
4. `get_capability` — Get capability with requirements
5. `list_requirements` — List requirements for a capability
6. `get_requirement` — Get requirement details
7. `get_node_content` — Get full content_md for any node (separate from get_* to handle large content)
8. `search_knowledge` — Text search across all node types

**Write Tools (6):**
9. `create_mission` — Create mission twin, validate, submit
10. `create_capability` — Create capability twin, validate, submit
11. `create_requirement` — Create requirement twin, validate, submit
12. `update_mission` — Update mission fields via diff
13. `update_capability` — Update capability fields via diff
14. `update_requirement` — Update requirement fields via diff

**Query Tools (3):**
15. `get_relationships` — Get all relationships for a node
16. `check_readiness` — Check if a capability is ready (all requirements met)
17. `get_dependency_graph` — Get dependency tree for a node

### Tool Definition Pattern

```typescript
{
  name: "list_missions",
  description: "List all missions with status and capability count",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["draft", "active", "complete", "cancelled"] },
      project: { type: "string", description: "Project slug filter" }
    }
  }
}
```

### Auth Integration

MCP config in claude_desktop_config.json:
```json
{
  "mcpServers": {
    "xpollination": {
      "command": "node",
      "args": ["src/index.ts"],
      "env": { "XPO_API_KEY": "xpo_..." }
    }
  }
}
```

### Twin Submission via MCP

Write tools use the digital twin protocol: create twin object → validate → submit to Mindspace API. Error messages include validation failures.

### Acceptance Criteria

- AC1: All 17 tools registered in MCP server
- AC2: Read tools return structured JSON
- AC3: Write tools validate via twin protocol
- AC4: content_md truncated to 4000 chars with "..." indicator
- AC5: Auth via XPO_API_KEY env var
- AC6: search_knowledge returns ranked results

### Test Plan

api/__tests__/mcp-knowledge-tools.test.ts
