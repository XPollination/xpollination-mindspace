# PDSA: Pichler-Mindspace Brain Setup

**Task:** ms-a13-3-pichler-mindspace
**Status:** Design
**Version:** v0.0.1

## Plan

Provisioning script for Pichler-Mindspace org brain. Creates Qdrant collection, seeds users (Thomas + Maria), verifies brain API connectivity.

### Dependencies
- ms-a13-1-org-brain-collection (org brain collection infrastructure)
- ms-a2-5-seed-data (seed data infrastructure)

### Investigation

**Current brain setup:**
- Single Qdrant collection at `localhost:3200`
- No org-level collection separation yet

**Design decisions:**
1. Provisioning script: `scripts/provision-pichler-mindspace.ts`
2. Creates Qdrant collection `pichler-mindspace` via Qdrant API (port 6333)
3. Seeds user records: Thomas (admin), Maria (contributor)
4. Verifies brain API can route to new collection
5. Idempotent — safe to run multiple times

## Do

### File Changes

#### 1. `scripts/provision-pichler-mindspace.ts` (CREATE)
```typescript
// Qdrant collection creation
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const collectionName = 'pichler-mindspace';

async function provision() {
  // 1. Create collection (if not exists)
  await fetch(`${QDRANT_URL}/collections/${collectionName}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vectors: { size: 1536, distance: 'Cosine' }
    })
  });

  // 2. Verify collection exists
  const check = await fetch(`${QDRANT_URL}/collections/${collectionName}`);
  if (!check.ok) throw new Error('Collection creation failed');

  // 3. Verify brain API health
  const health = await fetch('http://localhost:3200/api/v1/health');
  console.log('Brain health:', await health.json());

  console.log(`Provisioned: ${collectionName}`);
}
```

#### 2. `api/db/seed/pichler-mindspace-users.sql` (CREATE)
```sql
INSERT OR IGNORE INTO users (id, username, display_name, role) VALUES
  ('thomas-pichler', 'thomas', 'Thomas Pichler', 'admin'),
  ('maria-pichler', 'maria', 'Maria Pichler', 'contributor');
```

## Study

### Test Cases (6)
1. Script creates Qdrant collection
2. Script is idempotent (runs twice without error)
3. Thomas has admin access
4. Maria has contributor access
5. Brain API health check passes
6. Collection uses correct vector dimensions (1536)

## Act
- 1 provisioning script, 1 seed data file
- Infrastructure task, no API changes
