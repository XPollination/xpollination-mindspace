# PDSA: Bug → Orchestrator Notification

**Task:** ms-a16-2-bug-notification
**Status:** Design
**Version:** v0.0.1

## Plan

On bug submission: send BUG_REPORTED SSE message to connected agents on the project.

### Dependencies
- ms-a16-1-bug-reports (bug_reports table + POST endpoint)
- ms-a11-3-sse-infra (SSE infrastructure)

### Investigation

**Design decisions:**
1. Hook into bug report POST endpoint
2. After successful bug creation, broadcast SSE event
3. Event format: `{ type: 'BUG_REPORTED', bug_id, project_slug, title, severity }`
4. Send to ALL connected agents on the project (no role filtering)
5. Best-effort (bug creation succeeds even if SSE fails)

## Do

### File Changes

#### 1. `api/services/bug-broadcast.ts` (CREATE)
```typescript
export function broadcastBugReported(bugId: string, projectSlug: string, title: string, severity: string): void {
  const event = JSON.stringify({
    type: 'BUG_REPORTED', bug_id: bugId, project_slug: projectSlug, title, severity,
    timestamp: new Date().toISOString()
  });
  const clients = getSSEClients(projectSlug); // all roles
  for (const client of clients) {
    client.write(`event: bug_reported\ndata: ${event}\n\n`);
  }
}
```

#### 2. Bug reports route (UPDATE)
After POST bug creation: `broadcastBugReported(bug.id, slug, bug.title, bug.severity);`

## Study

### Test Cases (6)
1. Bug submission sends SSE event to connected clients
2. Event includes bug_id, title, severity
3. All connected agents receive (not role-filtered)
4. No error when no clients connected
5. Bug creation succeeds even if broadcast fails
6. Event type is 'BUG_REPORTED'

## Act
- 1 new service, 1 route update
