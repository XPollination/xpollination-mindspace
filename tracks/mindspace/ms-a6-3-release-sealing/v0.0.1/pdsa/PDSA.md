# PDSA: Release Sealing (Human Gate)

**Date:** 2026-03-11
**Task:** ms-a6-3-release-sealing
**Capability:** release-management
**Track:** mindspace-architecture
**Status:** PLAN
**Depends on:** ms-a6-2-release-manifest (release CRUD + manifest endpoint)

## Plan

### Problem

Releases can be created and updated freely. There is no immutability guarantee — a "sealed" release could be modified afterward. The sealing endpoint needs to enforce: once sealed, the release is frozen (no further modifications), and a git tag is created for traceability.

### Evidence

1. **REQ-BRANCH-001, REQ-GATE-001** — "Sealing transition: draft → testing → sealed (human gate). Sealed = immutable, creates git tag."
2. **PUT /:releaseId** — currently allows setting status='sealed' but does not enforce immutability or create git tags.
3. **Release manifest** — already generates `git_tag: v{version}`, but the tag is not actually created in git.

### Design

#### REQ-SEAL-001: Seal Endpoint

`POST /api/releases/:releaseId/seal`

Requires admin role. Validates:
1. Release exists and is in `testing` status (cannot seal from `draft`)
2. All tasks in manifest are `complete`
3. Approval token provided (human gate)

On success:
1. Set `status = 'sealed'`, `sealed_at = datetime('now')`, `sealed_by = user.id`
2. Mark release as immutable (subsequent PUT requests rejected with 409)
3. Return sealed release with manifest summary

#### REQ-SEAL-002: Immutability Guard

Add check to `PUT /:releaseId`: if release `status = 'sealed'`, return 409 "Cannot modify sealed release."

#### REQ-SEAL-003: Git Tag (Best-Effort)

After sealing, create a git tag `v{version}` pointing to current HEAD of the project's develop branch. Best-effort: if git command fails, log warning but complete the seal.

#### Implementation Files

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `api/routes/releases.ts` | UPDATE | Add POST /:releaseId/seal, add immutability guard to PUT |

### NOT Changed

- Release creation, listing, manifest — unchanged
- Git workflow — tag is additive, no branch changes

### Risks

1. **Git tag on wrong commit** — Tagging HEAD may not match the release's actual commits. Acceptable for v0.0.1; future: tag specific commit SHA.
2. **Concurrent seal** — Two admins sealing simultaneously. Mitigated: SQLite write lock serializes.

## Do

### File Changes

#### 1. `api/routes/releases.ts` (UPDATE)

Add to existing file:
```typescript
// POST /:releaseId/seal — seal a release (human gate)
app.post('/:releaseId/seal', async (request, reply) => {
  const user = (request as any).user;
  if (user.role !== 'admin') return reply.status(403).json({ error: 'Admin only' });

  const { releaseId } = request.params as { releaseId: string };
  const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(releaseId);
  if (!release) return reply.status(404).json({ error: 'Release not found' });
  if (release.status === 'sealed') return reply.status(409).json({ error: 'Already sealed' });
  if (release.status !== 'testing') return reply.status(400).json({ error: 'Can only seal from testing status' });

  db.prepare('UPDATE releases SET status = ?, sealed_at = datetime(?), sealed_by = ? WHERE id = ?')
    .run('sealed', 'now', user.id, releaseId);

  // Best-effort git tag
  try {
    execSync(`git tag v${release.version}`, { cwd: projectRoot });
  } catch { console.warn(`Failed to create git tag v${release.version}`); }

  return reply.status(200).json({ sealed: true, release_id: releaseId, version: release.version });
});

// Add immutability guard to PUT
// In existing PUT handler, add at top:
// if (existing.status === 'sealed') return reply.status(409).json({ error: 'Cannot modify sealed release' });
```

## Study

### Test Cases (6)

1. POST seal on testing release returns 200 and sets status=sealed
2. POST seal on draft release returns 400
3. POST seal on already sealed release returns 409
4. PUT on sealed release returns 409 (immutability guard)
5. POST seal by non-admin returns 403
6. Sealed release has sealed_at and sealed_by set

## Act

- Sealing working → releases have immutability guarantee
- Git tag creation → traceability from release to code
- Future: require specific commit SHA for tag instead of HEAD
