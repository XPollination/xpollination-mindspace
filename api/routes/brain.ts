import { Router, Request, Response } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getDb } from '../db/connection.js';
import { requireApiKeyOrJwt } from '../middleware/require-auth.js';

export const brainRouter = Router({ mergeParams: true });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_PREFIX = 'brain_org_';
const VECTOR_SIZE = 384;

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
