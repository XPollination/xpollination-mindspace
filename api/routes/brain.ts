import { Router, Request, Response } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const brainRouter = Router({ mergeParams: true });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const COLLECTION_PREFIX = 'brain_org_';
const PUBLIC_COLLECTION = process.env.BRAIN_PUBLIC_COLLECTION || 'best_practices';
const VECTOR_SIZE = 384;

/**
 * Resolve which Qdrant collections to target for read/write operations.
 * Write: org collection only (brain_org_{slug})
 * Read: org collection + public (brain_public/best_practices)
 */
export function resolveCollections(projectSlug: string, hasOrgBrain: boolean, orgBrainCollection: string | null): { write: string | null; read: string[] } {
  if (!hasOrgBrain || !orgBrainCollection) {
    return { write: null, read: [PUBLIC_COLLECTION] };
  }
  return {
    write: orgBrainCollection,
    read: [orgBrainCollection, PUBLIC_COLLECTION]
  };
}

brainRouter.use(requireApiKeyOrJwt);

// POST /provision — create Qdrant collection for project org brain
brainRouter.post('/provision', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  // Check project exists
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const collectionName = `${COLLECTION_PREFIX}${slug}`;
  const client = new QdrantClient({ url: QDRANT_URL });

  try {
    // Idempotent: check if collection already exists, skip if so
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      });
    }

    // Update projects table with has_org_brain flag
    db.prepare('UPDATE projects SET has_org_brain = 1, org_brain_collection = ? WHERE slug = ?')
      .run(collectionName, slug);

    res.status(201).json({
      provisioned: true,
      collection: collectionName,
      already_existed: exists,
      vector_size: VECTOR_SIZE,
      distance: 'Cosine'
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to provision brain: ${err.message}` });
  }
});

// GET /status — check brain status for project
brainRouter.get('/status', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT has_org_brain, org_brain_collection FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!project.has_org_brain || !project.org_brain_collection) {
    res.status(200).json({ provisioned: false, collection: null });
    return;
  }

  try {
    const client = new QdrantClient({ url: QDRANT_URL });
    const info = await client.getCollection(project.org_brain_collection);
    res.status(200).json({
      provisioned: true,
      collection: project.org_brain_collection,
      points_count: info.points_count,
      vectors_count: info.vectors_count
    });
  } catch {
    res.status(200).json({
      provisioned: true,
      collection: project.org_brain_collection,
      qdrant_reachable: false
    });
  }
});

// POST /contribute — write thought to org brain collection only
brainRouter.post('/contribute', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { prompt, agent_id, agent_name, session_id, context, thought_category, topic } = req.body;

  if (!prompt || prompt.length < 50) {
    res.status(400).json({ error: 'prompt is required and must be at least 50 characters' });
    return;
  }

  const db = getDb();
  const project = db.prepare('SELECT has_org_brain, org_brain_collection FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const route = resolveCollections(slug, !!project.has_org_brain, project.org_brain_collection);
  if (!route.write) {
    res.status(400).json({ error: `Project '${slug}' has no org brain provisioned` });
    return;
  }

  try {
    const response = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, agent_id, agent_name, session_id, context, thought_category, topic,
        collection: route.write
      })
    });

    const result = await response.json();
    res.status(response.status).json({
      ...result as object,
      routed_to: route.write,
      routing: 'org'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /query — read from org + public brain collections, merge results
brainRouter.post('/query', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { prompt, agent_id, agent_name, session_id } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  const db = getDb();
  const project = db.prepare('SELECT has_org_brain, org_brain_collection FROM projects WHERE slug = ?').get(slug) as any;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const route = resolveCollections(slug, !!project.has_org_brain, project.org_brain_collection);

  try {
    // Query each collection and merge results
    const results = await Promise.all(
      route.read.map(async (collection) => {
        const response = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt, agent_id, agent_name, session_id,
            read_only: true,
            collection
          })
        });
        const data = await response.json();
        return { collection, ...data as object };
      })
    );

    // Merge sources from all collections, sorted by score
    const allSources = results
      .flatMap((r: any) => (r.result?.sources || []).map((s: any) => ({ ...s, collection: r.collection })))
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    res.status(200).json({
      project_slug: slug,
      collections_queried: route.read,
      sources: allSources,
      results_by_collection: results.map((r: any) => ({
        collection: r.collection,
        response: r.result?.response,
        source_count: r.result?.sources?.length || 0
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
