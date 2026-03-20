# PDSA: Implement capability_version_history Table + Migration

**Task:** `version-history-table-impl`
**Version:** v0.0.1
**Status:** Design

## Plan

### Context

Migration 057 already creates the `capability_version_history` table (committed in design phase). This impl task adds CLI commands in `interface-cli.js` for creating version entries and querying version history.

### What DEV Implements

Two new CLI commands in `src/db/interface-cli.js`:

#### 1. `version-create` Command

```bash
node interface-cli.js version-create <capability_id> '{"changelog":"...", "contributing_tasks":"[...]", "requirements_satisfied":"[...]", "pdsa_ref":"..."}' <actor>
```

Function:

```javascript
function cmdVersionCreate(capabilityId, dataJson, actor) {
  const db = getDb();
  const data = JSON.parse(dataJson);

  // Get next version number for this capability
  const latest = db.prepare(
    "SELECT MAX(version) as max_ver FROM capability_version_history WHERE capability_id = ?"
  ).get(capabilityId);
  const nextVersion = (latest?.max_ver || 0) + 1;

  // Insert version entry
  db.prepare(`
    INSERT INTO capability_version_history
      (capability_id, version, changelog, contributing_tasks, requirements_satisfied, changed_by, pdsa_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    capabilityId,
    nextVersion,
    data.changelog || null,
    data.contributing_tasks ? JSON.stringify(data.contributing_tasks) : null,
    data.requirements_satisfied ? JSON.stringify(data.requirements_satisfied) : null,
    actor,
    data.pdsa_ref || null
  );

  const created = db.prepare(
    "SELECT * FROM capability_version_history WHERE capability_id = ? AND version = ?"
  ).get(capabilityId, nextVersion);

  console.log(JSON.stringify(created, null, 2));
}
```

#### 2. `version-list` Command

```bash
node interface-cli.js version-list <capability_id>
```

Function:

```javascript
function cmdVersionList(capabilityId) {
  const db = getDb();
  const versions = db.prepare(
    "SELECT * FROM capability_version_history WHERE capability_id = ? ORDER BY version DESC"
  ).all(capabilityId);

  console.log(JSON.stringify({ capability_id: capabilityId, versions, count: versions.length }, null, 2));
}
```

#### 3. CLI Routing (add to switch statement ~line 1095)

```javascript
case 'version-create': {
  const [capId, dataJson, actor] = args.slice(1);
  if (!capId || !dataJson || !actor) {
    console.error('Usage: version-create <capability_id> \'{"changelog":"..."}\' <actor>');
    process.exit(1);
  }
  cmdVersionCreate(capId, dataJson, actor);
  break;
}

case 'version-list': {
  const [capId] = args.slice(1);
  if (!capId) {
    console.error('Usage: version-list <capability_id>');
    process.exit(1);
  }
  cmdVersionList(capId);
  break;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/db/interface-cli.js` | Add `cmdVersionCreate()`, `cmdVersionList()`, and case routing |

### Migration Already Done

Migration `057-capability-version-history.sql` already exists and is deployed. No new migration needed.

### Test Reference

Tests: `api/__tests__/version-history-table.test.ts` (from test task)

## Do

DEV:
1. Add `cmdVersionCreate()` function to `src/db/interface-cli.js`
2. Add `cmdVersionList()` function to `src/db/interface-cli.js`
3. Add case routing in the main switch statement
4. Run tests: `npx vitest run api/__tests__/version-history-table`

## Study

Verify:
- `node interface-cli.js version-create cap-org-brain '{"changelog":"v1 release"}' pdsa` creates entry with version=1
- `node interface-cli.js version-create cap-org-brain '{"changelog":"v2 release"}' pdsa` auto-increments to version=2
- `node interface-cli.js version-list cap-org-brain` returns both versions, newest first
- All existing tests pass

## Act

### Design Decisions
1. **Auto-increment version**: No manual version number needed. Next version = max + 1.
2. **JSON input**: Consistent with existing `update-dna` pattern — pass JSON string as argument.
3. **Newest first**: `version-list` returns DESC order, consistent with changelog browsing.
4. **No delete command**: Version history is append-only. Deleting versions is destructive and out of scope.
5. **Actor as changed_by**: Reuses existing CLI actor pattern for attribution.
