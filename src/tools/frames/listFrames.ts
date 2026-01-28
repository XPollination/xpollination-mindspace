/**
 * List Frames Tool
 *
 * Lists all active content frames.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { FrameRepository } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const listFramesTool: Tool = {
  name: 'list_frames',
  description: `List all active content frames.

Returns all frames that are currently being monitored for trends.
Use this to see what topics are configured before crawling or to
check if a frame already exists before creating a new one.`,
  inputSchema: {
    type: 'object',
    properties: {
      includeInactive: {
        type: 'boolean',
        description: 'Include paused/inactive frames in the list'
      }
    },
    required: []
  }
};

/**
 * Handle the list_frames tool call
 */
export async function handleListFrames(
  input: { includeInactive?: boolean },
  repo: FrameRepository
): Promise<ListFramesResult> {
  const frames = input.includeInactive
    ? await repo.findAll()
    : await repo.findActive();

  // Parse JSON fields for each frame
  const parsedFrames = frames.map((frame: any) => ({
    id: frame.id,
    name: frame.name,
    description: frame.description,
    keywords: JSON.parse(frame.keywords || '[]'),
    sources: JSON.parse(frame.sources || '{}'),
    audience: frame.audience,
    tone: frame.tone,
    status: frame.status,
    createdAt: frame.created_at
  }));

  return {
    count: parsedFrames.length,
    frames: parsedFrames,
    message: parsedFrames.length > 0
      ? `Found ${parsedFrames.length} active frame(s): ${parsedFrames.map((f: any) => f.name).join(', ')}`
      : 'No active frames found. Use create_frame to define a new topic area.'
  };
}

export interface FrameSummary {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  sources: {
    rss?: string[];
    google_trends?: string[];
  };
  audience: string;
  tone: string;
  status: string;
  createdAt: string;
}

export interface ListFramesResult {
  count: number;
  frames: FrameSummary[];
  message: string;
}
