/**
 * Workflow States
 *
 * Defines all possible states in the content pipeline.
 * This is the STATIC definition - Claude follows this, doesn't decide it.
 */

export enum WorkflowState {
  // Initial state
  IDLE = 'IDLE',

  // Trend discovery phase
  CRAWLING = 'CRAWLING',
  TRENDS_READY = 'TRENDS_READY',

  // Topic selection phase
  PROPOSING = 'PROPOSING',
  AWAITING_TOPIC_SELECTION = 'AWAITING_TOPIC_SELECTION',
  TOPIC_SELECTED = 'TOPIC_SELECTED',

  // Content generation phase
  DRAFTING = 'DRAFTING',
  DRAFT_READY = 'DRAFT_READY',

  // Verification loop
  FACT_CHECKING = 'FACT_CHECKING',
  FACT_CHECK_PASSED = 'FACT_CHECK_PASSED',
  FACT_CHECK_FAILED = 'FACT_CHECK_FAILED',
  IMPROVING = 'IMPROVING',

  // Approval phase
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',

  // Publishing phase
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',

  // Error states
  ERROR = 'ERROR',
  MAX_ITERATIONS_REACHED = 'MAX_ITERATIONS_REACHED'
}

/**
 * States where user input is required (gates)
 */
export const USER_GATE_STATES = [
  WorkflowState.AWAITING_TOPIC_SELECTION,
  WorkflowState.AWAITING_APPROVAL,
  WorkflowState.MAX_ITERATIONS_REACHED
] as const;

/**
 * Terminal states (workflow complete)
 */
export const TERMINAL_STATES = [
  WorkflowState.PUBLISHED,
  WorkflowState.REJECTED,
  WorkflowState.ERROR
] as const;

/**
 * Check if state is a user gate
 */
export function isUserGate(state: WorkflowState): boolean {
  return USER_GATE_STATES.includes(state as typeof USER_GATE_STATES[number]);
}

/**
 * Check if state is terminal
 */
export function isTerminal(state: WorkflowState): boolean {
  return TERMINAL_STATES.includes(state as typeof TERMINAL_STATES[number]);
}
