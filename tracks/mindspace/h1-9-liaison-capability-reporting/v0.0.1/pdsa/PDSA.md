# PDSA: LIAISON Capability-Level Progress Reporting

**Task:** h1-9-liaison-capability-reporting
**Version:** v0.0.1
**Status:** Design

## Plan

### Goal

Enable LIAISON agent to report progress at capability level, not just task level. Currently pm-status.cjs lists individual tasks; this enhancement adds a capability progress section showing which capabilities are complete, in progress, or blocked.

### Current State

- `pm-status.cjs` lists all tasks per project via `interface-cli.js list`
- `interface-cli.js` has no capability-awareness
- Capabilities API exists at `GET /api/projects/:slug/capabilities` and `GET /api/projects/:slug/capabilities/:capId/progress`
- The pm-status skill runs as a Node.js script, not via HTTP API — it reads DB directly

### Design

#### 1. Add `capability-status` Command to interface-cli.js

New CLI command that queries capabilities and computes progress from linked tasks:

```bash
DATABASE_PATH=$DB node interface-cli.js capability-status
```

Output:
```json
{
  "mission": { "id": "...", "title": "Mindspace v1.0", "status": "active" },
  "capabilities": [
    {
      "id": "cap-foundation",
      "title": "Foundation",
      "status": "active",
      "progress_percent": 67,
      "tasks": { "complete": 4, "active": 1, "pending": 1, "total": 6 }
    }
  ],
  "summary": {
    "total_capabilities": 10,
    "complete": 2,
    "active": 6,
    "blocked": 1,
    "draft": 1,
    "overall_progress_percent": 45
  }
}
```

Implementation: Query `missions` table, then for each capability query linked tasks via `capability_requirements` + `requirement_task_groups` join (same as progress API), aggregate.

#### 2. Integrate into pm-status.cjs

Add capability status section to pm-status output:

```js
// After task scan, add capability status per project
for (const [name, dbPath] of Object.entries(DBS)) {
  try {
    const capOut = execSync(`DATABASE_PATH="${dbPath}" node ${CLI} capability-status`, ...);
    result.projects[name].capabilities = JSON.parse(capOut);
  } catch {
    // Not all projects have capabilities — skip silently
  }
}
```

#### 3. LIAISON Reporting Format

When LIAISON presents status to Thomas, capability section appears as:

```
## Capability Progress (Mindspace v1.0)
Overall: 45% (2/10 complete)

| Capability | Progress | Status | Tasks |
|-----------|----------|--------|-------|
| Foundation | 67% | active | 4/6 |
| Viz UI | 33% | active | 2/6 |
| ...
```

This is a presentation concern — LIAISON formats the data, DEV only needs to provide the CLI command and pm-status integration.

### Files to Change

1. `src/db/interface-cli.js` — UPDATE: Add `capability-status` command
2. `viz/pm-status.cjs` — UPDATE: Add capability status section to output

### Dependencies

- Requires `missions` and `capabilities` tables (from h1-1)
- Requires `capability_requirements` and `requirement_task_groups` tables (from h1-2, h1-4)
- Requires capability progress computation logic (from h1-3)

## Do

Implementation by DEV agent.

## Study

- `capability-status` CLI command returns correct progress for seeded data
- pm-status includes capability section in output
- Projects without capabilities are handled gracefully (skipped)

## Act

Run pm-status on TEST and verify capability section appears with accurate data.
