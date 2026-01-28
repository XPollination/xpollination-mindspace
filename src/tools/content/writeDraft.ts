/**
 * Write Draft Tool
 *
 * Creates a blog post draft from an approved proposal.
 * Stores the draft in the database for verification and review.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import type { DatabaseContext } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const writeDraftTool: Tool = {
  name: 'write_draft',
  description: `Create a blog post draft from an approved proposal.

Takes a refined proposal (after user approval) and generates a complete
markdown draft. The draft is stored in the database and flagged for
fact-checking.

Use this after the user has selected and approved a topic proposal.`,
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The final title for the blog post'
      },
      angle: {
        type: 'string',
        description: 'The specific angle/perspective for the post'
      },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points to cover in the post'
      },
      userFraming: {
        type: 'string',
        description: 'Additional context or direction from the user'
      },
      frameId: {
        type: 'string',
        description: 'The frame ID this content belongs to'
      },
      content: {
        type: 'string',
        description: 'The full markdown content of the draft'
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            needsVerification: { type: 'boolean' }
          },
          required: ['text', 'needsVerification']
        },
        description: 'Factual claims in the content that may need verification'
      },
      metadata: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          category: { type: 'string' },
          estimatedReadTime: { type: 'string' }
        },
        description: 'Additional metadata for the post'
      }
    },
    required: ['title', 'frameId', 'content']
  }
};

export interface Claim {
  text: string;
  needsVerification: boolean;
}

export interface WriteDraftInput {
  title: string;
  angle?: string;
  keyPoints?: string[];
  userFraming?: string;
  frameId: string;
  content: string;
  claims?: Claim[];
  metadata?: {
    tags?: string[];
    category?: string;
    estimatedReadTime?: string;
  };
}

export interface DraftRecord {
  id: string;
  frameId: string;
  title: string;
  content: string;
  angle?: string;
  userFraming?: string;
  claims: string; // JSON
  metadata: string; // JSON
  status: 'draft' | 'pending_verification' | 'verified' | 'approved' | 'published';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WriteDraftResult {
  draftId: string;
  title: string;
  status: string;
  claimsToVerify: number;
  wordCount: number;
  message: string;
  nextStep: string;
}

/**
 * Handle the write_draft tool call
 */
export async function handleWriteDraft(
  input: WriteDraftInput,
  db: DatabaseContext
): Promise<WriteDraftResult> {
  const draftId = randomUUID();
  const { title, frameId, content, angle, userFraming, claims, metadata } = input;

  // Verify frame exists
  const frame = await db.frameRepo.findById(frameId);
  if (!frame) {
    throw new Error(`Frame not found: ${frameId}`);
  }

  // Count claims that need verification
  const claimsToVerify = claims?.filter(c => c.needsVerification).length ?? 0;

  // Calculate word count
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // Store draft in database
  await db.draftRepo.create({
    id: draftId,
    frameId,
    title,
    content,
    angle: angle || null,
    userFraming: userFraming || null,
    claims: JSON.stringify(claims || []),
    metadata: JSON.stringify(metadata || {}),
    status: claimsToVerify > 0 ? 'pending_verification' : 'draft',
    version: 1
  });

  const status = claimsToVerify > 0 ? 'pending_verification' : 'draft';

  return {
    draftId,
    title,
    status,
    claimsToVerify,
    wordCount,
    message: claimsToVerify > 0
      ? `Draft created with ${claimsToVerify} claim(s) flagged for verification.`
      : `Draft created successfully. Ready for review.`,
    nextStep: claimsToVerify > 0
      ? 'Use fact_check to verify the flagged claims.'
      : 'Present the draft to the user for approval, then use publish_post.'
  };
}
