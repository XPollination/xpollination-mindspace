# PDSA: Implement — node_relationships Table + Migration

**Task:** `relationship-table-impl`
**Version:** v0.0.1
**Status:** Design

## Plan

### Context

Migration 058 already creates the `node_relationships` table (committed in design phase). The design phase also added `VALID_RELATIONSHIP_TYPES` to interface-cli.js. This impl task ensures CLI commands for relationship CRUD are complete.

### What DEV Implements

Verify and complete the following in `src/db/interface-cli.js`:

#### 1. `relationship-create` Command

```bash
node interface-cli.js relationship-create <source_type> <source_id> <relation> <target_type> <target_id> [metadata_json] <actor>
```

```javascript
function cmdRelationshipCreate(sourceType, sourceId, relation, targetType, targetId, metadataJson, actor) {
  const db = getDb();
  if (!VALID_RELATIONSHIP_TYPES.includes(relation)) {
    console.error(JSON.stringify({ error: `Invalid relation: ${relation}. Valid: ${VALID_RELATIONSHIP_TYPES.join(', ')}` }));
    process.exit(1);
  }
  db.prepare(`
    INSERT INTO node_relationships (source_type, source_id, relation, target_type, target_id, metadata, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sourceType, sourceId, relation, targetType, targetId, metadataJson || null, actor);

  const created = db.prepare(
    "SELECT * FROM node_relationships WHERE source_type = ? AND source_id = ? AND relation = ? AND target_type = ? AND target_id = ?"
  ).get(sourceType, sourceId, relation, targetType, targetId);
  console.log(JSON.stringify(created, null, 2));
}
```

#### 2. `relationship-list` Command

```bash
node interface-cli.js relationship-list <type> <id> [--direction=outgoing|incoming|both]
```

```javascript
function cmdRelationshipList(nodeType, nodeId, direction) {
  const db = getDb();
  let rows = [];
  if (direction !== 'incoming') {
    rows = rows.concat(db.prepare(
      "SELECT *, 'outgoing' as direction FROM node_relationships WHERE source_type = ? AND source_id = ?"
    ).all(nodeType, nodeId));
  }
  if (direction !== 'outgoing') {
    rows = rows.concat(db.prepare(
      "SELECT *, 'incoming' as direction FROM node_relationships WHERE target_type = ? AND target_id = ?"
    ).all(nodeType, nodeId));
  }
  console.log(JSON.stringify({ node: `${nodeType}:${nodeId}`, relationships: rows, count: rows.length }, null, 2));
}
```

#### 3. `relationship-delete` Command

```bash
node interface-cli.js relationship-delete <source_type> <source_id> <relation> <target_type> <target_id> <actor>
```

```javascript
function cmdRelationshipDelete(sourceType, sourceId, relation, targetType, targetId, actor) {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM node_relationships WHERE source_type = ? AND source_id = ? AND relation = ? AND target_type = ? AND target_id = ?"
  ).run(sourceType, sourceId, relation, targetType, targetId);
  console.log(JSON.stringify({ deleted: result.changes > 0, actor }, null, 2));
}
```

#### 4. CLI Routing

```javascript
case 'relationship-create': {
  const [sType, sId, rel, tType, tId, ...rest] = args.slice(1);
  const actor = rest.length > 1 ? rest[rest.length - 1] : rest[0];
  const meta = rest.length > 1 ? rest[0] : null;
  if (!sType || !sId || !rel || !tType || !tId || !actor) {
    console.error('Usage: relationship-create <source_type> <source_id> <relation> <target_type> <target_id> [metadata_json] <actor>');
    process.exit(1);
  }
  cmdRelationshipCreate(sType, sId, rel, tType, tId, meta, actor);
  break;
}

case 'relationship-list': {
  const [nType, nId] = args.slice(1);
  const dirFlag = args.find(a => a.startsWith('--direction='));
  const direction = dirFlag ? dirFlag.split('=')[1] : 'both';
  if (!nType || !nId) {
    console.error('Usage: relationship-list <type> <id> [--direction=outgoing|incoming|both]');
    process.exit(1);
  }
  cmdRelationshipList(nType, nId, direction);
  break;
}

case 'relationship-delete': {
  const [sType, sId, rel, tType, tId, actor] = args.slice(1);
  if (!sType || !sId || !rel || !tType || !tId || !actor) {
    console.error('Usage: relationship-delete <source_type> <source_id> <relation> <target_type> <target_id> <actor>');
    process.exit(1);
  }
  cmdRelationshipDelete(sType, sId, rel, tType, tId, actor);
  break;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/db/interface-cli.js` | Add/verify relationship-create, relationship-list, relationship-delete commands |

### Test Reference

Tests: `api/__tests__/relationship-table.test.ts`

## Do

DEV:
1. Verify migration 058 is deployed
2. Add/complete relationship CLI commands in interface-cli.js
3. Add case routing for all 3 commands
4. Run tests

## Study

Verify:
- `relationship-create mission m1 COMPOSES capability c1 pdsa` creates row
- `relationship-list mission m1` returns outgoing relationships
- `relationship-list capability c1 --direction=incoming` returns incoming only
- `relationship-delete mission m1 COMPOSES capability c1 pdsa` removes row
- Invalid relation type rejected with error

## Act

### Design Decisions
1. **3 commands**: create, list, delete. Covers full CRUD (no update — relationships are immutable, delete+recreate).
2. **Direction flag**: `--direction=outgoing|incoming|both` for targeted queries.
3. **Delete by full tuple**: Requires exact match of all 5 fields. No bulk delete.
4. **JSON error output**: Consistent with existing CLI error pattern.
