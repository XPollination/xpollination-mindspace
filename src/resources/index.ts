/**
 * Resource Registry
 *
 * Exports all MCP resources and the handler function.
 */

import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseContext } from '../tools/index.js';

export interface ResourceDefinition {
  definition: Resource;
  handler: (uri: string, db: DatabaseContext) => Promise<unknown>;
}

/**
 * All available resources
 */
export const resources: ResourceDefinition[] = [
  {
    definition: {
      uri: 'content://frames',
      name: 'Active Frames',
      description: 'List all active content frames',
      mimeType: 'application/json'
    },
    handler: async (_uri, db) => {
      const frames = await db.frameRepo.findActive();
      return {
        frames: frames.map(f => ({
          id: f.id,
          name: f.name,
          description: f.description,
          keywords: JSON.parse(f.keywords || '[]'),
          audience: f.audience,
          tone: f.tone,
          status: f.status,
          createdAt: f.created_at
        }))
      };
    }
  },
  {
    definition: {
      uri: 'content://drafts',
      name: 'Draft Content',
      description: 'List all drafts by status',
      mimeType: 'application/json'
    },
    handler: async (_uri, db) => {
      const drafts = await db.draftRepo.findByStatus('draft');
      const pending = await db.draftRepo.findByStatus('pending_verification');
      const verified = await db.draftRepo.findByStatus('verified');

      return {
        drafts: [...drafts, ...pending, ...verified],
        summary: {
          draft: drafts.length,
          pendingVerification: pending.length,
          verified: verified.length,
          total: drafts.length + pending.length + verified.length
        }
      };
    }
  },
  {
    definition: {
      uri: 'content://queue',
      name: 'Approval Queue',
      description: 'Content awaiting user approval',
      mimeType: 'application/json'
    },
    handler: async (_uri, db) => {
      // Queue contains verified drafts awaiting final approval
      const verified = await db.draftRepo.findByStatus('verified');

      return {
        queue: verified,
        count: verified.length,
        message: verified.length > 0
          ? `${verified.length} item(s) awaiting approval`
          : 'No items in approval queue'
      };
    }
  }
];

/**
 * Handle a resource read by URI
 */
export async function handleResourceRead(
  uri: string,
  db: DatabaseContext
): Promise<unknown> {
  // Check for exact match first
  const exactMatch = resources.find(r => r.definition.uri === uri);
  if (exactMatch) {
    return exactMatch.handler(uri, db);
  }

  // Check for pattern match (e.g., content://frames/{id})
  if (uri.startsWith('content://frames/')) {
    const id = uri.replace('content://frames/', '');
    const frame = await db.frameRepo.findById(id);

    if (!frame) {
      return { frame: null, error: `Frame not found: ${id}` };
    }

    return {
      frame: {
        id: frame.id,
        name: frame.name,
        description: frame.description,
        keywords: JSON.parse(frame.keywords || '[]'),
        sources: JSON.parse(frame.sources || '{}'),
        audience: frame.audience,
        tone: frame.tone,
        exclusions: JSON.parse(frame.exclusions || '[]'),
        status: frame.status,
        createdAt: frame.created_at,
        updatedAt: frame.updated_at
      }
    };
  }

  if (uri.startsWith('content://drafts/')) {
    const id = uri.replace('content://drafts/', '');
    const draft = await db.draftRepo.findById(id);

    if (!draft) {
      return { draft: null, error: `Draft not found: ${id}` };
    }

    const draftData = draft as any;
    return {
      draft: {
        id: draftData.id,
        frameId: draftData.frameId,
        title: draftData.title,
        content: draftData.content,
        angle: draftData.angle,
        claims: JSON.parse(draftData.claims || '[]'),
        metadata: JSON.parse(draftData.metadata || '{}'),
        status: draftData.status,
        version: draftData.version,
        createdAt: draftData.created_at,
        updatedAt: draftData.updated_at
      }
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
}
