# PDSA: Release Manifest Generation

**Task:** ms-a6-2-release-manifest
**Status:** Design
**Version:** v0.0.1

## Plan

Add GET endpoint that generates a manifest for a release: included requirements, tasks, feature flag states, and CHANGELOG entries.

### Dependencies
- ms-a6-1-release-table (releases table)

### Investigation

**Current state (`api/routes/releases.ts`):**
- POST/GET/PUT for releases (CRUD)
- No manifest endpoint
- Releases have `id, project_slug, version, status, created_by, sealed_at, sealed_by`
- No release_items or release_tasks join table yet

**Design decisions:**
1. GET `/:releaseId/manifest` endpoint
2. Manifest aggregates: all complete tasks in project, their linked requirements, their feature_flags, and git tag reference
3. Since there's no release_items table yet, manifest returns ALL complete tasks (future: scoped to release)
4. Returns JSON with sections: tasks, requirements, flags, metadata

## Do

### File Changes

#### 1. `api/routes/releases.ts` (UPDATE)
```typescript
// GET /:releaseId/manifest — generate release manifest
releasesRouter.get('/:releaseId/manifest', requireProjectAccess('viewer'), (req, res) => {
  const { slug, releaseId } = req.params;
  const db = getDb();

  const release = db.prepare('SELECT * FROM releases WHERE id = ? AND project_slug = ?').get(releaseId, slug) as any;
  if (!release) return res.status(404).json({ error: 'Release not found' });

  // Complete tasks in project
  const tasks = db.prepare("SELECT id, title, status, current_role, feature_flag_name FROM tasks WHERE project_slug = ? AND status = 'complete'").all(slug);

  // Requirements linked to complete tasks
  const requirements = db.prepare(
    "SELECT DISTINCT r.id, r.req_id_human, r.title, r.status FROM requirements r JOIN tasks t ON t.requirement_id = r.id WHERE t.project_slug = ? AND t.status = 'complete'"
  ).all(slug);

  // Feature flags
  const flags = db.prepare("SELECT flag_name, state, task_id FROM feature_flags WHERE project_slug = ?").all(slug);

  res.status(200).json({
    release: { id: release.id, version: release.version, status: release.status },
    manifest: {
      generated_at: new Date().toISOString(),
      tasks,
      requirements,
      feature_flags: flags,
      git_tag: `v${release.version}`
    }
  });
});
```

## Study

### Test Cases (8)
1. Manifest returns complete tasks for project
2. Manifest includes linked requirements (deduped)
3. Manifest includes all feature flags with states
4. Manifest includes git_tag based on version
5. Release not found → 404
6. Empty project → empty arrays in manifest
7. Sealed release manifest still accessible
8. generated_at is current timestamp

## Act
- 1 file update: releases.ts
- No migration
