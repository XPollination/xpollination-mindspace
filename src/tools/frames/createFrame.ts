/**
 * Create Frame Tool
 *
 * Creates a new content frame from a conversation.
 * Call this AFTER discussing the topic with the user and aligning on keywords,
 * sources, audience, and tone.
 */

import { z } from 'zod';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuid } from 'uuid';
import type { FrameRepository } from '../../db/client.js';

// Input validation schema
const CreateFrameInput = z.object({
  name: z.string().min(1).max(100).describe('Short identifier for the frame (e.g., "fourth-temple")'),
  description: z.string().optional().describe('Longer description of what this frame covers'),
  keywords: z.array(z.string()).min(1).describe('Keywords to match when crawling trends'),
  sources: z.object({
    rss: z.array(z.string().url()).optional().describe('RSS feed URLs to monitor'),
    google_trends: z.array(z.string()).optional().describe('Google Trends queries to track')
  }).describe('Sources to monitor for this frame'),
  audience: z.string().optional().describe('Target audience description'),
  tone: z.string().optional().describe('Desired writing tone'),
  exclusions: z.array(z.string()).optional().describe('Keywords to exclude from results')
});

export type CreateFrameInput = z.infer<typeof CreateFrameInput>;

/**
 * Tool definition exposed to Claude
 */
export const createFrameTool: Tool = {
  name: 'create_frame',
  description: `Create a new content frame from a conversation.

A frame defines a topic area to monitor for trends. Call this AFTER discussing
the topic with the user and aligning on:
- Keywords to search for
- Sources to monitor (RSS feeds, Google Trends queries)
- Target audience
- Desired tone

Example usage:
1. User says "I want to write about the Fourth Temple concept"
2. Discuss: What aspects? (ecclesiology, leadership, transformation)
3. Discuss: What sources? (Christian blogs, theology journals)
4. Discuss: What audience? (Christians, leaders)
5. Call create_frame with the aligned configuration`,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Short identifier for the frame (e.g., "fourth-temple")'
      },
      description: {
        type: 'string',
        description: 'Longer description of what this frame covers'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords to match when crawling trends'
      },
      sources: {
        type: 'object',
        properties: {
          rss: {
            type: 'array',
            items: { type: 'string' },
            description: 'RSS feed URLs to monitor'
          },
          google_trends: {
            type: 'array',
            items: { type: 'string' },
            description: 'Google Trends queries to track'
          }
        },
        description: 'Sources to monitor for this frame'
      },
      audience: {
        type: 'string',
        description: 'Target audience description'
      },
      tone: {
        type: 'string',
        description: 'Desired writing tone'
      },
      exclusions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords to exclude from results'
      }
    },
    required: ['name', 'keywords', 'sources']
  }
};

/**
 * Handle the create_frame tool call
 */
export async function handleCreateFrame(
  input: unknown,
  repo: FrameRepository
): Promise<CreateFrameResult> {
  // Validate input
  const validated = CreateFrameInput.parse(input);

  // Generate unique ID
  const frameId = uuid();

  // Store in database
  await repo.create({
    id: frameId,
    name: validated.name,
    description: validated.description || '',
    keywords: JSON.stringify(validated.keywords),
    sources: JSON.stringify(validated.sources),
    audience: validated.audience || '',
    tone: validated.tone || '',
    exclusions: JSON.stringify(validated.exclusions || []),
    status: 'active'
  });

  return {
    success: true,
    frameId,
    name: validated.name,
    message: `Frame "${validated.name}" created successfully with ID ${frameId}. ` +
      `It will be included in the next trend crawl. ` +
      `Keywords: ${validated.keywords.join(', ')}`
  };
}

export interface CreateFrameResult {
  success: boolean;
  frameId: string;
  name: string;
  message: string;
}
