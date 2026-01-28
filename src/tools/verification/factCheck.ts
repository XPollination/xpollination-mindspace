/**
 * Fact Check Tool
 *
 * Verifies factual claims in a draft using web search.
 * Returns a verification report with verdicts for each claim.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { DatabaseContext } from '../../db/client.js';

/**
 * Tool definition exposed to Claude
 */
export const factCheckTool: Tool = {
  name: 'fact_check',
  description: `Verify factual claims in a draft.

Retrieves the draft's claims and provides a structure for Claude to
verify each claim using web search. Returns a verification report
with verdicts (TRUE, FALSE, UNVERIFIABLE) and supporting sources.

Use this after write_draft when claims need verification.`,
  inputSchema: {
    type: 'object',
    properties: {
      draftId: {
        type: 'string',
        description: 'The draft ID to fact-check'
      },
      verificationResults: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            claimText: { type: 'string' },
            verdict: {
              type: 'string',
              enum: ['TRUE', 'FALSE', 'UNVERIFIABLE', 'NEEDS_CONTEXT']
            },
            confidence: {
              type: 'number',
              description: '0-1 confidence in the verdict'
            },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  title: { type: 'string' },
                  relevantQuote: { type: 'string' }
                }
              }
            },
            notes: { type: 'string' }
          },
          required: ['claimText', 'verdict']
        },
        description: 'Verification results for each claim (provided by Claude after research)'
      }
    },
    required: ['draftId']
  }
};

export interface VerificationSource {
  url: string;
  title?: string;
  relevantQuote?: string;
}

export interface ClaimVerification {
  claimText: string;
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIABLE' | 'NEEDS_CONTEXT';
  confidence?: number;
  sources?: VerificationSource[];
  notes?: string;
}

export interface FactCheckInput {
  draftId: string;
  verificationResults?: ClaimVerification[];
}

export interface FactCheckResult {
  draftId: string;
  draftTitle: string;
  claimsToVerify: {
    text: string;
    needsVerification: boolean;
  }[];
  verificationReport?: {
    totalClaims: number;
    verified: number;
    failed: number;
    unverifiable: number;
    needsContext: number;
    pass: boolean;
    issues: string[];
    results: ClaimVerification[];
  };
  message: string;
  nextStep: string;
}

/**
 * Handle the fact_check tool call
 */
export async function handleFactCheck(
  input: FactCheckInput,
  db: DatabaseContext
): Promise<FactCheckResult> {
  const { draftId, verificationResults } = input;

  // Get the draft
  const draft = await db.draftRepo.findById(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  const draftData = draft as any;
  const claims = JSON.parse(draftData.claims || '[]');
  const claimsToVerify = claims.filter((c: any) => c.needsVerification);

  // If no verification results provided, return claims for Claude to verify
  if (!verificationResults) {
    return {
      draftId,
      draftTitle: draftData.title,
      claimsToVerify,
      message: `Found ${claimsToVerify.length} claim(s) to verify. ` +
        `Use web search to verify each claim, then call fact_check again with verificationResults.`,
      nextStep: 'Research each claim using web search, then provide verificationResults.'
    };
  }

  // Process verification results
  const verified = verificationResults.filter(r => r.verdict === 'TRUE').length;
  const failed = verificationResults.filter(r => r.verdict === 'FALSE').length;
  const unverifiable = verificationResults.filter(r => r.verdict === 'UNVERIFIABLE').length;
  const needsContext = verificationResults.filter(r => r.verdict === 'NEEDS_CONTEXT').length;

  const issues: string[] = [];

  // Collect issues from failed claims
  for (const result of verificationResults) {
    if (result.verdict === 'FALSE') {
      issues.push(`INCORRECT: "${result.claimText}" - ${result.notes || 'Needs correction'}`);
    } else if (result.verdict === 'NEEDS_CONTEXT') {
      issues.push(`CONTEXT NEEDED: "${result.claimText}" - ${result.notes || 'Add clarification'}`);
    }
  }

  // Determine if verification passed
  const pass = failed === 0 && needsContext === 0;

  // Update draft status based on results
  const newStatus = pass ? 'verified' : 'pending_verification';
  await db.draftRepo.update(draftId, { status: newStatus });

  const verificationReport = {
    totalClaims: verificationResults.length,
    verified,
    failed,
    unverifiable,
    needsContext,
    pass,
    issues,
    results: verificationResults
  };

  return {
    draftId,
    draftTitle: draftData.title,
    claimsToVerify,
    verificationReport,
    message: pass
      ? `All claims verified successfully. Draft is ready for approval.`
      : `Verification found ${issues.length} issue(s) that need to be addressed.`,
    nextStep: pass
      ? 'Present the verified draft to the user for approval.'
      : 'Use improve_draft to fix the identified issues, then re-run fact_check.'
  };
}
