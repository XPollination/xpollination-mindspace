# PDSA: SpiceDB Deployment + Data Migration from SQLite

**Task:** spicedb-setup-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-OG-003

## Problem

Relationships are stored in SQLite node_relationships table (SpiceDB-compatible tuple format). For multi-agent authorization, real-time permission checks, and federation, we need actual SpiceDB. The node_relationships table was designed as a staging ground.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Docker Compose with SpiceDB + PostgreSQL | CX22 has Docker. PostgreSQL is SpiceDB's recommended production backend. ~300MB RAM total. |
| D2 | PostgreSQL backend (not memory) | Need persistence across restarts. Memory datastore loses data. |
| D3 | Dual-write for 2-week transition | Write to both SQLite and SpiceDB. Read from SpiceDB. Fallback to SQLite if SpiceDB down. |
| D4 | Feature flag SPICEDB_ENABLED | Gradual rollout. Default false. Toggle without deploy. |
| D5 | Migration script reads node_relationships, writes SpiceDB tuples | One-time bulk load. Idempotent (SpiceDB deduplicates). |

### SpiceDB Schema

```zed
definition user {}

definition agent {
  relation owner: user
  relation project: project
  permission manage = owner
}

definition project {
  relation owner: user
  relation member: user | agent
  permission view = owner + member
  permission edit = owner
}

definition mission {
  relation project: project
  relation composes: capability
  permission view = project->view
}

definition capability {
  relation mission: mission
  relation implements: requirement
  permission view = mission->view
}

definition requirement {
  relation capability: capability
  relation project: project
  permission view = project->view
}

definition task {
  relation requirement: requirement
  relation assignee: agent | user
  relation project: project
  permission view = project->view
  permission work = assignee
}

definition attestation {
  relation task: task
  relation submitter: agent
  permission view = task->view
}
```

### Docker Compose

```yaml
services:
  spicedb:
    image: authzed/spicedb:latest
    command: serve
    environment:
      - SPICEDB_GRPC_PRESHARED_KEY=${SPICEDB_KEY}
      - SPICEDB_DATASTORE_ENGINE=postgres
      - SPICEDB_DATASTORE_CONN_URI=postgres://spicedb:${SPICEDB_DB_PASS}@spicedb-postgres:5432/spicedb?sslmode=disable
    ports:
      - "127.0.0.1:50051:50051"  # gRPC
      - "127.0.0.1:8443:8443"    # HTTP gateway
    depends_on:
      - spicedb-postgres

  spicedb-postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=spicedb
      - POSTGRES_PASSWORD=${SPICEDB_DB_PASS}
      - POSTGRES_DB=spicedb
    volumes:
      - spicedb-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5433:5432"  # Non-standard port to avoid conflicts

volumes:
  spicedb-data:
```

### Migration Script

```javascript
// scripts/migrate-sqlite-to-spicedb.js
// 1. Read all rows from node_relationships
// 2. Map to SpiceDB WriteRelationships API
// 3. Batch write (100 tuples per request)
// 4. Verify count matches

// Mapping: node_relationships → SpiceDB tuples
// source_type:source_id#relation@target_type:target_id
// → WriteRelationshipRequest { resource, relation, subject }
```

### Dual-Write Strategy

```
Phase 1 (Week 1-2): SPICEDB_ENABLED=false
  - Deploy SpiceDB + PostgreSQL
  - Run migration script
  - Verify tuple counts match

Phase 2 (Week 3-4): SPICEDB_ENABLED=true, SPICEDB_FALLBACK=true
  - Dual-write: SQLite + SpiceDB on every relationship change
  - Read from SpiceDB, fallback to SQLite on error
  - Monitor error rates

Phase 3 (Week 5+): SPICEDB_ENABLED=true, SPICEDB_FALLBACK=false
  - SpiceDB is primary
  - SQLite writes continue (backward compat)
  - Eventually remove SQLite relationship writes
```

### Client Library

```javascript
// src/spicedb/client.js
import { v1 } from '@authzed/authzed-node';

const client = v1.NewClient(
  process.env.SPICEDB_TOKEN,
  'localhost:50051',
  v1.ClientSecurity.INSECURE_LOCALHOST
);

export async function checkPermission(resource, permission, subject) { ... }
export async function writeRelationship(resource, relation, subject) { ... }
export async function deleteRelationship(resource, relation, subject) { ... }
export async function lookupResources(resourceType, permission, subject) { ... }
```

### Acceptance Criteria

- AC1: docker-compose.spicedb.yml starts SpiceDB + PostgreSQL
- AC2: Schema loads without errors
- AC3: Migration script transfers all node_relationships tuples
- AC4: SPICEDB_ENABLED feature flag controls read path
- AC5: Dual-write works for new relationships
- AC6: Fallback to SQLite when SpiceDB unavailable
- AC7: @authzed/authzed-node client wrapper

### Test Plan

Tests in api/__tests__/spicedb-setup.test.ts: docker-compose file exists, schema validates, migration script runs, feature flag toggles, client exports functions.

## Do / Study / Act

*(To be filled after implementation)*
