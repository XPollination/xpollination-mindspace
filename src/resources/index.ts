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
    handler: async (_uri, _db) => {
      // TODO: Implement frame listing
      return { frames: [] };
    }
  },
  {
    definition: {
      uri: 'content://drafts',
      name: 'Draft Content',
      description: 'List all drafts by status',
      mimeType: 'application/json'
    },
    handler: async (_uri, _db) => {
      // TODO: Implement draft listing
      return { drafts: [] };
    }
  },
  {
    definition: {
      uri: 'content://queue',
      name: 'Approval Queue',
      description: 'Content awaiting user approval',
      mimeType: 'application/json'
    },
    handler: async (_uri, _db) => {
      // TODO: Implement queue listing
      return { queue: [] };
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
    // TODO: Implement single frame fetch
    return { frame: null, id };
  }

  if (uri.startsWith('content://drafts/')) {
    const id = uri.replace('content://drafts/', '');
    // TODO: Implement single draft fetch
    return { draft: null, id };
  }

  throw new Error(`Unknown resource: ${uri}`);
}
