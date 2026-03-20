# PDSA: Service as Digital Twin — Self-Aware Lifecycle

**Task:** service-twin-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-A2A-006

## Problem

Services (viz, API, brain) have no self-awareness. They don't know their version, can't handle upgrades gracefully, and have no rollback protocol.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Manifest as JSON file (service-manifest.json) | Declarative, readable, editable without code changes. Git-tracked. |
| D2 | Graceful handoff via dual-process (not cluster) | Simpler. New process starts, old drains connections, old exits. No shared IPC. |
| D3 | Health check determines rollback | If new process fails health check within 30s, kill new, keep old. |

### ServiceInterface v1.0

```typescript
interface ServiceManifest {
  name: string;           // "mindspace-viz"
  version: string;        // "0.0.36"
  port: number;           // 4200
  health_endpoint: string; // "/health"
  environment: string;     // "production"
  dependencies: string[];  // ["brain-api", "mindspace-api"]
  startup_command: string; // "node viz/server.js"
  graceful_shutdown_ms: number; // 5000
}

interface ServiceTwin {
  manifest: ServiceManifest;
  status: 'starting' | 'healthy' | 'degraded' | 'shutting_down' | 'stopped';
  pid: number | null;
  started_at: string | null;
  last_health_check: string | null;
}
```

### EVOLVE Event Handler

```
1. Receive EVOLVE event (new version available)
2. Start new process with new version
3. Wait for new process health check (30s timeout)
4. If healthy: drain old process connections → stop old → new is primary
5. If unhealthy: kill new → old stays primary → emit EVOLVE_FAILED
```

### Rollback Protocol

```
1. EVOLVE_FAILED triggers rollback
2. Old process continues serving
3. Log failure reason to brain
4. Alert via /tmp/human-notification.json
5. Block future EVOLVE until manual review
```

### Acceptance Criteria

- AC1: service-manifest.json schema defined
- AC2: ServiceTwin tracks status and PID
- AC3: EVOLVE handler starts new, health-checks, swaps
- AC4: Rollback on health failure within 30s
- AC5: Graceful connection drain during handoff

### Test Plan

api/__tests__/service-twin.test.ts
