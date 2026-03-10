# PDSA: Brain routing logic (private → org → public)

**Task:** ms-a13-2-brain-routing
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10

## Problem

The brain API (Fastify at :3200) currently operates on a single shared collection (`best_practices`). With org brain collections provisioned per project (ms-a13-1), we need routing logic that determines which collection(s) to read from and write to based on agent context.

The routing hierarchy is: **private → org → public**. An agent working on a project should write to the org collection and read from both org + public. A "Feature 17" (F17) gate controls promotion from org to public.

## Requirements (AC from task DNA)

1. Agent contributions go to org collection (project-scoped)
2. Agent can READ from org + public collections
3. Agent WRITES to org collection only
4. F17 gate at org → public boundary
5. Contributions routed to correct collection

## Investigation

### Brain API (localhost:3200)

The brain API at `:3200` is a separate Fastify service. It has:
- `POST /api/v1/memory` — contribute/query thoughts
- Operates on `best_practices` collection (public/shared)
- Uses `@qdrant/js-client-rest` for vector operations
- 384-dimensional vectors, Cosine distance

### Org brain collections (ms-a13-1)

`brain.ts` provisions Qdrant collections named `brain_org_{slug}` per project. The `projects` table tracks `has_org_brain` and `org_brain_collection`.

### Design approach

The routing logic belongs in the mindspace API (:3100), not the brain API (:3200). The mindspace API is the project-aware service — it knows about projects, agents, and access control. It acts as a router that:
1. Receives brain operations from project-scoped agents
2. Determines the target collection(s) based on project context
3. Proxies to Qdrant directly (same client library as brain.ts)

This avoids coupling the brain API to project awareness. The brain API remains a generic vector store interface. The mindspace API adds the project-aware routing layer.

### Collection hierarchy

```
Public:  best_practices (shared, read by all)
Org:     brain_org_{slug} (per-project, read/write by project agents)
Private: (future — agent-local memory, out of scope)
```

## Design

### File 1: `api/services/brain-router.ts` (NEW)

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { getDb } from '../db/connection.js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const PUBLIC_COLLECTION = process.env.BRAIN_PUBLIC_COLLECTION || 'best_practices';

export interface BrainRouteContext {
  projectSlug: string;
  agentId?: string;
  operation: 'read' | 'write';
}

export interface BrainRouteResult {
  collections: string[];  // Ordered: org first, then public (for reads)
  writeCollection: string | null;  // Only set for write operations
  publicCollection: string;
}

/**
 * Determine which Qdrant collections to target based on project context.
 *
 * READ: [org_collection, public_collection] — search both, merge results
 * WRITE: org_collection only — never write directly to public
 */
export function resolveCollections(context: BrainRouteContext): BrainRouteResult {
  const db = getDb();

  const project = db.prepare(
    'SELECT has_org_brain, org_brain_collection FROM projects WHERE slug = ?'
  ).get(context.projectSlug) as any;

  if (!project) {
    throw new Error(`Project not found: ${context.projectSlug}`);
  }

  const orgCollection = project.has_org_brain ? project.org_brain_collection : null;

  if (context.operation === 'write') {
    if (!orgCollection) {
      throw new Error(`Project '${context.projectSlug}' has no org brain provisioned. Provision first via POST /api/projects/${context.projectSlug}/brain/provision`);
    }
    return {
      collections: [orgCollection],
      writeCollection: orgCollection,
      publicCollection: PUBLIC_COLLECTION
    };
  }

  // READ: search org (if exists) + public
  const collections: string[] = [];
  if (orgCollection) {
    collections.push(orgCollection);
  }
  collections.push(PUBLIC_COLLECTION);

  return {
    collections,
    writeCollection: null,
    publicCollection: PUBLIC_COLLECTION
  };
}

export function getQdrantClient(): QdrantClient {
  return new QdrantClient({ url: QDRANT_URL });
}
```

### File 2: `api/routes/brain.ts` (UPDATE)

Add project-scoped brain read/write endpoints alongside existing provision/status:

```typescript
// POST /api/projects/:slug/brain/contribute — write thought to org collection
brainRouter.post('/contribute', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { prompt, agent_id, agent_name, session_id, context, thought_category, topic } = req.body;

  if (!prompt || prompt.length < 50) {
    res.status(400).json({ error: 'prompt is required and must be at least 50 characters' });
    return;
  }

  try {
    const route = resolveCollections({ projectSlug: slug, agentId: agent_id, operation: 'write' });

    // Forward to brain API with collection override
    const brainUrl = process.env.BRAIN_API_URL || 'http://localhost:3200';
    const response = await fetch(`${brainUrl}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, agent_id, agent_name, session_id, context, thought_category, topic,
        collection: route.writeCollection
      })
    });

    const result = await response.json();
    res.status(response.status).json({
      ...result,
      routed_to: route.writeCollection,
      routing: 'org'
    });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// POST /api/projects/:slug/brain/query — read from org + public collections
brainRouter.post('/query', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { prompt, agent_id, agent_name, session_id, read_only } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  try {
    const route = resolveCollections({ projectSlug: slug, agentId: agent_id, operation: 'read' });
    const brainUrl = process.env.BRAIN_API_URL || 'http://localhost:3200';

    // Query each collection and merge results
    const results = await Promise.all(
      route.collections.map(async (collection) => {
        const response = await fetch(`${brainUrl}/api/v1/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt, agent_id, agent_name, session_id,
            read_only: true,
            collection
          })
        });
        const data = await response.json();
        return { collection, ...data };
      })
    );

    // Merge sources from all collections, sorted by score
    const allSources = results
      .flatMap(r => (r.result?.sources || []).map((s: any) => ({ ...s, collection: r.collection })))
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    res.status(200).json({
      project_slug: slug,
      collections_queried: route.collections,
      sources: allSources,
      results_by_collection: results.map(r => ({
        collection: r.collection,
        response: r.result?.response,
        source_count: r.result?.sources?.length || 0
      }))
    });
  } catch (err: any) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});
```

### File 3: No F17 gate implementation in this task

The F17 gate (org → public promotion) is mentioned in the AC but is a separate concern. It requires:
- Human approval workflow (approval request table)
- Thought selection UI in viz
- Promotion endpoint

This task establishes the routing logic that makes the gate possible. The actual gate mechanism depends on ms-a9-1-approval-requests and will be a future task.

## Design Decisions

1. **Routing in mindspace API, not brain API** — brain stays generic, mindspace adds project awareness
2. **resolveCollections() pure function** — testable, reusable across endpoints
3. **Proxy to brain API** — uses the existing brain API at :3200 with `collection` parameter, rather than duplicating Qdrant vector logic. This requires the brain API to support a `collection` parameter (may need minor update).
4. **Read merges results** — queries all relevant collections, merges sources sorted by score
5. **Write is org-only** — never writes directly to public, enforcing the F17 boundary
6. **No brain provisioned = error on write, graceful on read** — reads can still query public even without org brain

## Files Changed

1. `api/services/brain-router.ts` — Collection routing logic (NEW)
2. `api/routes/brain.ts` — Add /contribute and /query endpoints (UPDATE)

## Testing

1. `resolveCollections()` returns org + public for read operations
2. `resolveCollections()` returns only org for write operations
3. `resolveCollections()` throws when project not found
4. `resolveCollections()` throws on write when org brain not provisioned
5. `resolveCollections()` returns only public for read when org brain not provisioned
6. POST /contribute returns 400 when prompt is missing or too short
7. POST /contribute routes to org collection
8. POST /contribute returns 404 when project not found
9. POST /contribute returns error when org brain not provisioned
10. POST /query returns merged results from org + public
11. POST /query returns only public results when org brain not provisioned
12. POST /query sources sorted by score across collections
13. POST /query returns 400 when prompt is missing
14. POST /query returns 404 when project not found
15. Response includes `routed_to` and `routing` metadata
16. Returns 401 when not authenticated
