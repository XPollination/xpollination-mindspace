/**
 * Workflow Transitions
 *
 * Defines all valid state transitions in the content pipeline.
 * This is the STATIC process definition that guides agentic work.
 */

import { WorkflowState } from './states.js';

export interface WorkflowContext {
  workflowId: string;
  draftId: string;
  currentState: WorkflowState;
  iterationCount: number;
  maxIterations: number;
  metadata: Record<string, unknown>;
}

export interface Transition {
  from: WorkflowState;
  to: WorkflowState;
  trigger: string;
  description: string;
  guard?: (context: WorkflowContext) => boolean;
}

/**
 * All valid transitions in the content pipeline.
 * Claude cannot transition outside of these rules.
 */
export const TRANSITIONS: Transition[] = [
  // ============================================
  // TREND DISCOVERY PHASE
  // ============================================
  {
    from: WorkflowState.IDLE,
    to: WorkflowState.CRAWLING,
    trigger: 'START_CRAWL',
    description: 'Begin crawling trends for active frames'
  },
  {
    from: WorkflowState.CRAWLING,
    to: WorkflowState.TRENDS_READY,
    trigger: 'CRAWL_COMPLETE',
    description: 'Trend crawl finished successfully'
  },
  {
    from: WorkflowState.CRAWLING,
    to: WorkflowState.ERROR,
    trigger: 'CRAWL_ERROR',
    description: 'Trend crawl failed'
  },

  // ============================================
  // TOPIC SELECTION PHASE
  // ============================================
  {
    from: WorkflowState.TRENDS_READY,
    to: WorkflowState.PROPOSING,
    trigger: 'PROPOSE',
    description: 'Analyze trends and generate topic proposals'
  },
  {
    from: WorkflowState.PROPOSING,
    to: WorkflowState.AWAITING_TOPIC_SELECTION,
    trigger: 'PROPOSALS_READY',
    description: 'Proposals generated, waiting for user selection'
  },
  {
    from: WorkflowState.AWAITING_TOPIC_SELECTION,
    to: WorkflowState.TOPIC_SELECTED,
    trigger: 'TOPIC_SELECTED',
    description: 'User selected a topic and provided framing'
  },
  {
    from: WorkflowState.AWAITING_TOPIC_SELECTION,
    to: WorkflowState.IDLE,
    trigger: 'NO_TOPICS_SELECTED',
    description: 'User dismissed all proposals'
  },

  // ============================================
  // CONTENT GENERATION PHASE
  // ============================================
  {
    from: WorkflowState.TOPIC_SELECTED,
    to: WorkflowState.DRAFTING,
    trigger: 'START_DRAFT',
    description: 'Begin writing draft content'
  },
  {
    from: WorkflowState.DRAFTING,
    to: WorkflowState.DRAFT_READY,
    trigger: 'DRAFT_COMPLETE',
    description: 'Draft generation finished'
  },

  // ============================================
  // VERIFICATION LOOP
  // ============================================
  {
    from: WorkflowState.DRAFT_READY,
    to: WorkflowState.FACT_CHECKING,
    trigger: 'START_FACT_CHECK',
    description: 'Begin fact-checking claims in draft'
  },
  {
    from: WorkflowState.FACT_CHECKING,
    to: WorkflowState.FACT_CHECK_PASSED,
    trigger: 'FACT_CHECK_PASS',
    description: 'All claims verified successfully'
  },
  {
    from: WorkflowState.FACT_CHECKING,
    to: WorkflowState.FACT_CHECK_FAILED,
    trigger: 'FACT_CHECK_FAIL',
    description: 'Some claims failed verification'
  },
  {
    from: WorkflowState.FACT_CHECK_FAILED,
    to: WorkflowState.IMPROVING,
    trigger: 'START_IMPROVEMENT',
    description: 'Begin improving draft to fix issues',
    guard: (ctx) => ctx.iterationCount < ctx.maxIterations
  },
  {
    from: WorkflowState.FACT_CHECK_FAILED,
    to: WorkflowState.MAX_ITERATIONS_REACHED,
    trigger: 'MAX_ITERATIONS',
    description: 'Maximum improvement iterations reached',
    guard: (ctx) => ctx.iterationCount >= ctx.maxIterations
  },
  {
    from: WorkflowState.IMPROVING,
    to: WorkflowState.DRAFT_READY,
    trigger: 'IMPROVEMENT_COMPLETE',
    description: 'Draft improved, ready for re-check'
  },

  // ============================================
  // APPROVAL PHASE
  // ============================================
  {
    from: WorkflowState.FACT_CHECK_PASSED,
    to: WorkflowState.AWAITING_APPROVAL,
    trigger: 'REQUEST_APPROVAL',
    description: 'Request user approval for publishing'
  },
  {
    from: WorkflowState.AWAITING_APPROVAL,
    to: WorkflowState.APPROVED,
    trigger: 'USER_APPROVED',
    description: 'User approved content for publishing'
  },
  {
    from: WorkflowState.AWAITING_APPROVAL,
    to: WorkflowState.REJECTED,
    trigger: 'USER_REJECTED',
    description: 'User rejected content'
  },
  {
    from: WorkflowState.AWAITING_APPROVAL,
    to: WorkflowState.IMPROVING,
    trigger: 'USER_REQUESTS_CHANGES',
    description: 'User requested changes to draft'
  },
  {
    from: WorkflowState.MAX_ITERATIONS_REACHED,
    to: WorkflowState.AWAITING_APPROVAL,
    trigger: 'USER_REVIEW_ANYWAY',
    description: 'User wants to review despite iteration limit'
  },
  {
    from: WorkflowState.MAX_ITERATIONS_REACHED,
    to: WorkflowState.REJECTED,
    trigger: 'USER_ABANDON',
    description: 'User abandons draft after iteration limit'
  },

  // ============================================
  // PUBLISHING PHASE
  // ============================================
  {
    from: WorkflowState.APPROVED,
    to: WorkflowState.PUBLISHING,
    trigger: 'START_PUBLISH',
    description: 'Begin publishing to Hugo site'
  },
  {
    from: WorkflowState.PUBLISHING,
    to: WorkflowState.PUBLISHED,
    trigger: 'PUBLISH_COMPLETE',
    description: 'Content published successfully'
  },
  {
    from: WorkflowState.PUBLISHING,
    to: WorkflowState.ERROR,
    trigger: 'PUBLISH_ERROR',
    description: 'Publishing failed'
  },

  // ============================================
  // RESET TRANSITIONS
  // ============================================
  {
    from: WorkflowState.PUBLISHED,
    to: WorkflowState.IDLE,
    trigger: 'RESET',
    description: 'Reset to idle after successful publish'
  },
  {
    from: WorkflowState.REJECTED,
    to: WorkflowState.IDLE,
    trigger: 'RESET',
    description: 'Reset to idle after rejection'
  },
  {
    from: WorkflowState.ERROR,
    to: WorkflowState.IDLE,
    trigger: 'RESET',
    description: 'Reset to idle after error'
  }
];

/**
 * Get valid triggers for a given state
 */
export function getValidTriggers(
  state: WorkflowState,
  context?: WorkflowContext
): string[] {
  return TRANSITIONS
    .filter(t => t.from === state)
    .filter(t => !t.guard || !context || t.guard(context))
    .map(t => t.trigger);
}

/**
 * Find a transition by from state and trigger
 */
export function findTransition(
  from: WorkflowState,
  trigger: string
): Transition | undefined {
  return TRANSITIONS.find(t => t.from === from && t.trigger === trigger);
}
