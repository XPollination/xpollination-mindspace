# PDSA: Organization brain collection creation endpoint

**Task:** ms-a13-1-org-brain-collection
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

Projects need their own org-level brain collections in Qdrant for shared knowledge. Currently, brain collections are either per-user (`thought_space_{user_id}`) or global (`thought_space_shared`), provisioned manually via bash script. We need an API endpoint to create org brain collections dynamically when a project enables it.

## Requirements (REQ-BRAIN-ORG-001)

> When project has has_org_brain:true: create Qdrant collection brain_org_{project_slug}. POST /api/projects/:slug/brain/provision. AC: Collection created in Qdrant, project record updated.

## Investigation

### Existing brain infrastructure

- **Qdrant:** Running at `http://localhost:6333`
- **Vector config:** 384 dimensions (all-MiniLM-L6-v2), Cosine distance
- **Collection creation:** `@qdrant/js-client-rest` library, `client.createCollection(name, config)`
- **Payload indexes:** 8 fields — contributor_id, thought_type, tags, knowledge_space_id, thought_category, topic, quality_flags (keyword), access_count (integer), pheromone_weight (float), created_at/last_accessed (datetime)
- **Naming:** Existing pattern is `thought_space_{user_id}`, org pattern will be `brain_org_{project_slug}`
- **Brain API port:** 3200 (xpollination-best-practices)
- **Mindspace API port:** 3100 (xpollination-mcp-server-test)

### Design decisions

1. **Endpoint on Mindspace API** — `POST /api/projects/:slug/brain/provision` on port 3100 (not on brain API). This keeps project management centralized.
2. **Calls Qdrant directly** — Uses `@qdrant/js-client-rest` to create collection. This avoids circular dependency between Mindspace API and Brain API.
3. **Collection name:** `brain_org_{project_slug}` — matches requirement.
4. **Same vector config** as existing collections: 384 dims, Cosine, optimizers default_segment_number: 2.
5. **Same payload indexes** as thought_space — these are needed for the brain's query patterns.
6. **Idempotent** — If collection already exists, return 200 (not error). Qdrant returns error on duplicate; we catch and treat as success.
7. **projects table update** — Add `has_org_brain` and `org_brain_collection` columns via migration. Endpoint sets these on provision.
8. **Auth required** — All authenticated users can provision (authorization deferred to ms-a2-3).
9. **QDRANT_URL env** — Defaults to `http://localhost:6333`.

## Design

### File 1: `api/db/migrations/009-project-brain.sql` (NEW)

```sql
ALTER TABLE projects ADD COLUMN has_org_brain INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN org_brain_collection TEXT;
```

### File 2: `api/routes/project-brain.ts` (NEW)

```typescript
import { Router, Request, Response } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const projectBrainRouter = Router({ mergeParams: true });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const EMBEDDING_DIM = 384;

projectBrainRouter.use(requireApiKeyOrJwt);

// POST /api/projects/:slug/brain/provision — create org brain collection
projectBrainRouter.post('/provision', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  // Verify project exists
  const project = db.prepare('SELECT slug, has_org_brain, org_brain_collection FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  // Already provisioned?
  if (project.has_org_brain && project.org_brain_collection) {
    res.status(200).json({
      provisioned: true,
      collection: project.org_brain_collection,
      message: 'Brain collection already exists'
    });
    return;
  }

  const collectionName = `brain_org_${slug}`;
  const client = new QdrantClient({ url: QDRANT_URL });

  try {
    // Create Qdrant collection
    await client.createCollection(collectionName, {
      vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
      optimizers_config: { default_segment_number: 2 },
      replication_factor: 1
    });

    // Create payload indexes for brain query patterns
    const keywordFields = ['contributor_id', 'thought_type', 'tags', 'knowledge_space_id', 'thought_category', 'topic', 'quality_flags'];
    for (const field of keywordFields) {
      await client.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: 'keyword'
      });
    }
    await client.createPayloadIndex(collectionName, { field_name: 'access_count', field_schema: 'integer' });
    await client.createPayloadIndex(collectionName, { field_name: 'pheromone_weight', field_schema: 'float' });
    await client.createPayloadIndex(collectionName, { field_name: 'created_at', field_schema: 'datetime' });
    await client.createPayloadIndex(collectionName, { field_name: 'last_accessed', field_schema: 'datetime' });

  } catch (err: any) {
    // Collection may already exist in Qdrant but not tracked in DB
    if (err?.status !== 409 && !err?.message?.includes('already exists')) {
      res.status(500).json({ error: `Failed to create Qdrant collection: ${err.message}` });
      return;
    }
  }

  // Update project record
  db.prepare('UPDATE projects SET has_org_brain = 1, org_brain_collection = ? WHERE slug = ?')
    .run(collectionName, slug);

  res.status(201).json({
    provisioned: true,
    collection: collectionName,
    message: 'Brain collection created successfully'
  });
});

// GET /api/projects/:slug/brain — get brain status
projectBrainRouter.get('/', (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT slug, has_org_brain, org_brain_collection FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.status(200).json({
    has_org_brain: !!project.has_org_brain,
    collection: project.org_brain_collection || null
  });
});
```

### File 3: `api/server.ts` (UPDATE)

Add import and mount:
```typescript
import { projectBrainRouter } from './routes/project-brain.js';
// ...
app.use('/api/projects/:slug/brain', projectBrainRouter);
```

### File 4: `package.json` (UPDATE)

Add dependency:
```json
"@qdrant/js-client-rest": "^1.12.0"
```

## Files Changed

1. `api/db/migrations/009-project-brain.sql` — ALTER TABLE projects add has_org_brain, org_brain_collection (NEW)
2. `api/routes/project-brain.ts` — POST /provision + GET / endpoints (NEW)
3. `api/server.ts` — mount projectBrainRouter (UPDATE)
4. `package.json` — add @qdrant/js-client-rest dependency (UPDATE)

## Testing

1. `api/db/migrations/009-project-brain.sql` exists
2. Migration adds has_org_brain column (default 0)
3. Migration adds org_brain_collection column (nullable)
4. `api/routes/project-brain.ts` exists
5. projectBrainRouter exported
6. POST /api/projects/:slug/brain/provision creates Qdrant collection
7. POST sets collection name to brain_org_{slug}
8. POST creates collection with 384-dim Cosine vectors
9. POST creates payload indexes (keyword, integer, float, datetime)
10. POST updates project: has_org_brain=1, org_brain_collection=name
11. POST returns 201 on new provision
12. POST returns 200 if already provisioned (idempotent)
13. POST returns 404 for unknown project
14. POST returns 500 on Qdrant failure
15. GET /api/projects/:slug/brain returns brain status
16. GET returns 404 for unknown project
17. All endpoints require authentication
18. server.ts mounts projectBrainRouter at /api/projects/:slug/brain
19. package.json includes @qdrant/js-client-rest dependency
