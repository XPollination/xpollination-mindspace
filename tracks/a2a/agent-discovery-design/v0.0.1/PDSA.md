# PDSA: .well-known/agent.json A2A Discovery for Hive

**Task:** agent-discovery-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-HB-002

## Problem

The Hive (brain API at port 3200) has no A2A discovery endpoint. Agents cannot discover Hive capabilities programmatically. Mindspace already has agent.json — Hive needs the same pattern.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Follow Google A2A spec structure with xpo extensions | Interoperable base, extend for Hive-specific capabilities. |
| D2 | Include both Hive AND Mindspace endpoints | Agents connect to Hive first, need to discover Mindspace too. Hive is the entry point. |
| D3 | Fastify route at /.well-known/agent.json | Standard discovery path. Fastify (not Express) since Hive uses Fastify. |

### agent.json Schema

```json
{
  "name": "XPollination Hive",
  "description": "Shared knowledge brain — semantic search, memory, and agent coordination",
  "version": "1.0",
  "protocol": "xpo-a2a-v1",
  "capabilities": [
    "semantic_search",
    "memory_store",
    "memory_retrieve",
    "thought_tracing",
    "agent_identity",
    "best_practices"
  ],
  "authentication": {
    "type": "bearer_token",
    "header": "Authorization",
    "format": "Bearer {api_key}",
    "registration_url": "https://mindspace.xpollination.earth/register"
  },
  "endpoints": {
    "health": "/api/v1/health",
    "memory": "/api/v1/memory",
    "query": "/api/v1/query",
    "ingest": "/api/v1/ingest",
    "identity": "/api/v1/agent-identity"
  },
  "related_services": {
    "mindspace": {
      "agent_card": "https://mindspace.xpollination.earth/.well-known/agent.json",
      "description": "Task orchestration and project management"
    }
  },
  "digital_twin_schema": "https://mindspace.xpollination.earth/schemas/digital-twin-v1.json"
}
```

### Acceptance Criteria

- AC1: GET /.well-known/agent.json returns valid JSON
- AC2: Capabilities list matches actual Hive endpoints
- AC3: Authentication describes Bearer token pattern
- AC4: Related services links to Mindspace agent card
- AC5: Response includes Content-Type: application/json

### Test Plan

Tests in hive api/__tests__/agent-discovery.test.ts: endpoint exists, JSON valid, capabilities match, auth described.
