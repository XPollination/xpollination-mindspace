/**
 * Improve Draft Tool
 *
 * Fixes issues identified by fact-checking.
 * Creates a new version of the draft with corrections.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DatabaseContext } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const improveDraftTool: Tool = {
  name: 'improve_draft',
  description: `Fix issues identified by fact-checking.

Takes a draft ID and the improved content with corrections applied.
Creates a new version of the draft, preserving the history.

Use this after fact_check identifies issues that need to be fixed.`,
  inputSchema: {
    type: 'object',
    properties: {
      draftId: {
        type: 'string',
        description: 'The draft ID to improve'
      },
      improvedContent: {
        type: 'string',
        description: 'The corrected markdown content'
      },
      changesSummary: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of changes made to address issues'
      },
      updatedClaims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            needsVerification: { type: 'boolean' }
          },
          required: ['text', 'needsVerification']
        },
        description: 'Updated list of claims (with new/modified claims flagged)'
      }
    },
    required: ['draftId', 'improvedContent', 'changesSummary']
  }
};

export interface Claim {
  text: string;
  needsVerification: boolean;
}

export interface ImproveDraftInput {
  draftId: string;
  improvedContent: string;
  changesSummary: string[];
  updatedClaims?: Claim[];
}

export interface ImproveDraftResult {
  draftId: string;
  title: string;
  version: number;
  changesMade: string[];
  newClaimsToVerify: number;
  wordCount: number;
  message: string;
  nextStep: string;
}

/**
 * Handle the improve_draft tool call
 */
export async function handleImproveDraft(
  input: ImproveDraftInput,
  db: DatabaseContext
): Promise<ImproveDraftResult> {
  const { draftId, improvedContent, changesSummary, updatedClaims } = input;

  // Get the current draft
  const draft = await db.draftRepo.findById(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const draftData = draft as any;
  const currentVersion = draftData.version || 1;
  const newVersion = currentVersion + 1;

  // Count new claims that need verification
  const newClaimsToVerify = updatedClaims?.filter(c => c.needsVerification).length ?? 0;

  // Calculate word count
  const wordCount = improvedContent.split(/\s+/).filter(Boolean).length;

  // Update the draft with new content
  await db.draftRepo.update(draftId, {
    content: improvedContent,
    claims: JSON.stringify(updatedClaims || []),
    version: newVersion,
    status: newClaimsToVerify > 0 ? 'pending_verification' : 'verified'
  });

  return {
    draftId,
    title: draftData.title,
    version: newVersion,
    changesMade: changesSummary,
    newClaimsToVerify,
    wordCount,
    message: `Draft updated to version ${newVersion}. ${changesSummary.length} change(s) applied.`,
    nextStep: newClaimsToVerify > 0
      ? 'Re-run fact_check to verify the updated claims.'
      : 'The draft is ready for user approval. Present it for review.'
  };
}
