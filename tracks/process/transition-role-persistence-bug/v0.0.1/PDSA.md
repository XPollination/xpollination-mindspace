# PDSA: Bug fix — transition CLI role change not persisting

**Task:** transition-role-persistence-bug
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The `interface-cli.js transition` command reports `success: true` with `roleChanged: { from: "pdsa", to: "liaison" }` but the role change does not persist in the database. Subsequent reads show the original role. This has been observed on multiple tasks (ms-a1-6-google-oauth, rework-transition-wrong-role, rework-liaison-role-routing).

## Investigation

### Code analysis (interface-cli.js lines 677-696)

The transition function:
1. Line 417: Parses `dna` from `node.dna_json`
2. Line 418: Reads `currentRole = dna.role || null`
3. Line 644: Calls `getNewRoleForTransition()` — returns correct new role
4. Line 677-680: Creates `updatedDna` with new role if changed
5. Line 683-696: Runs UPDATE if `dnaChanged` is true
6. Line 706-707: Reports `roleChanged` in output

### Root cause: Missing write verification + TOCTOU vulnerability

**Issue 1: No `.changes` check (line 689)**
```javascript
db.prepare(`
  UPDATE mindspace_nodes
  SET status = ?, dna_json = ?, updated_at = datetime('now')
  WHERE id = ?
`).run(newStatus, JSON.stringify(updatedDna), node.id);
```
The `run()` method returns a `RunResult` with `.changes` property. If the UPDATE matches 0 rows (e.g., concurrent deletion, ID mismatch), `.changes` is 0 but no error is thrown. The function proceeds to report success.

**Issue 2: No transaction around read-modify-write (TOCTOU)**
The node is read at line 410, DNA is parsed and modified, then written back at line 689. If another process (agent-monitor, another CLI call, viz server) modifies the row between read and write, the write overwrites those changes OR the write fails silently.

**Issue 3: WAL mode contention**
With WAL mode, multiple readers can coexist with one writer. However, if another connection holds a write lock (e.g., monitor's periodic queries triggering auto-checkpoint), the CLI's UPDATE could be blocked. better-sqlite3 has a default busy timeout of 0 (no retry), meaning the write fails immediately with SQLITE_BUSY — but this would throw an error, not silently fail.

**Most likely cause:** Issue 1 — the `.changes` count is not verified. Combined with potential TOCTOU race, the UPDATE may match 0 rows due to stale `node.id` or concurrent modification.

### Isolated test

SQLite UPDATE with better-sqlite3 works correctly in isolation (tested with in-memory DB). The bug requires specific timing conditions to reproduce.

## Design

### Fix 1: Verify `.changes` after UPDATE (CRITICAL)

At line 689, check the result:
```javascript
const updateResult = db.prepare(`
  UPDATE mindspace_nodes
  SET status = ?, dna_json = ?, updated_at = datetime('now')
  WHERE id = ?
`).run(newStatus, JSON.stringify(updatedDna), node.id);

if (updateResult.changes === 0) {
  db.close();
  error(`Transition write failed: 0 rows updated for id=${node.id}. Row may have been deleted or modified concurrently.`);
}
```

Same check for the non-dnaChanged path (line 691-696):
```javascript
const updateResult = db.prepare(`
  UPDATE mindspace_nodes
  SET status = ?, updated_at = datetime('now')
  WHERE id = ?
`).run(newStatus, node.id);

if (updateResult.changes === 0) {
  db.close();
  error(`Transition write failed: 0 rows updated for id=${node.id}. Row may have been deleted or modified concurrently.`);
}
```

### Fix 2: Wrap read-modify-write in a transaction

Wrap the entire read+validate+write sequence in a transaction to prevent TOCTOU:
```javascript
const transition = db.transaction(() => {
  // Re-read node within transaction for consistency
  const node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ? OR slug = ?').get(id, id);
  // ... validation, role calculation, DNA update ...
  const result = db.prepare('UPDATE ...').run(...);
  if (result.changes === 0) throw new Error('0 rows updated');
  return { node, updatedDna };
});

try {
  const { node, updatedDna } = transition();
} catch (e) {
  db.close();
  error(e.message);
}
```

### Fix 3: Add verification read-back (DEFENSE IN DEPTH)

After the write, read back to verify:
```javascript
// Verify write persisted
const verification = db.prepare('SELECT json_extract(dna_json, "$.role") as role FROM mindspace_nodes WHERE id = ?').get(node.id);
if (verification && newRole && verification.role !== newRole) {
  console.error(JSON.stringify({
    warning: 'Role verification failed after write',
    expected: newRole,
    actual: verification.role,
    node_id: node.id
  }));
}
```

### Fix 4: Set busy timeout

Add a busy timeout to handle WAL contention:
```javascript
function getDb() {
  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/xpollination.db');
  const db = new Database(dbPath);
  db.pragma('busy_timeout = 5000');  // Wait up to 5s for write lock
  return db;
}
```

## Files Changed

1. `src/db/interface-cli.js` — add `.changes` checks, transaction wrapping, verification read-back, busy timeout (UPDATE)

## Testing

1. Transition with valid role change: `.changes` is 1, role persists on read-back
2. Transition with no role change: `.changes` is 1, status updated correctly
3. Multiple rapid transitions on same task: all persist correctly
4. Concurrent CLI calls: no silent data loss
5. `review->review:pdsa` transition: role changes from pdsa to liaison and persists
6. `review->review:qa` transition: role changes from qa to pdsa and persists
7. `active->approval` transition: role changes from pdsa to liaison and persists
8. Verification read-back matches expected role after every transition
9. busy_timeout set in getDb()
10. Error thrown when `.changes` is 0
