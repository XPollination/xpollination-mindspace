/**
 * Workflow Engine
 *
 * Executes state transitions according to the defined rules.
 * This enforces the STATIC process - Claude cannot bypass it.
 */

import { WorkflowState, isUserGate, isTerminal } from './states.js';
import {
  WorkflowContext,
  Transition,
  TRANSITIONS,
  getValidTriggers,
  findTransition
} from './transitions.js';
import { WorkflowRepository } from '../db/client.js';

export class WorkflowEngine {
  constructor(private repo: WorkflowRepository) {}

  /**
   * Get valid triggers for current state
   * This tells Claude what actions are available
   */
  getAvailableTriggers(context: WorkflowContext): string[] {
    return getValidTriggers(context.currentState, context);
  }

  /**
   * Execute a transition
   * Returns new state or throws if invalid
   */
  async transition(
    context: WorkflowContext,
    trigger: string
  ): Promise<WorkflowState> {
    const transition = findTransition(context.currentState, trigger);

    if (!transition) {
      const valid = this.getAvailableTriggers(context);
      throw new Error(
        `Invalid transition: ${context.currentState} -> ${trigger}. ` +
        `Valid triggers: ${valid.join(', ')}`
      );
    }

    // Check guard condition
    if (transition.guard && !transition.guard(context)) {
      throw new Error(
        `Guard failed for transition: ${trigger}. ` +
        `Context: iterations=${context.iterationCount}/${context.maxIterations}`
      );
    }

    // Update state in database
    await this.repo.updateState(
      context.workflowId,
      transition.to,
      context.currentState,
      trigger
    );

    // Increment iteration if entering improvement phase
    if (transition.to === WorkflowState.IMPROVING) {
      await this.repo.incrementIteration(context.workflowId);
    }

    return transition.to;
  }

  /**
   * Check if workflow is at a user gate
   */
  isAtUserGate(state: WorkflowState): boolean {
    return isUserGate(state);
  }

  /**
   * Check if workflow is complete
   */
  isComplete(state: WorkflowState): boolean {
    return isTerminal(state);
  }

  /**
   * Check if workflow can proceed automatically (no user input needed)
   */
  canAutoProceed(state: WorkflowState): boolean {
    return !this.isAtUserGate(state) &&
           !this.isComplete(state) &&
           state !== WorkflowState.ERROR;
  }

  /**
   * Get current context for a workflow
   */
  async getContext(workflowId: string): Promise<WorkflowContext | null> {
    const data = await this.repo.findByDraft(workflowId);
    if (!data) return null;

    // TODO: Map database record to WorkflowContext
    return data as WorkflowContext;
  }

  /**
   * Create a new workflow for a draft
   */
  async createWorkflow(draftId: string): Promise<WorkflowContext> {
    const workflowId = await this.repo.create({
      draftId,
      currentState: WorkflowState.IDLE,
      iterationCount: 0,
      maxIterations: 3
    });

    return {
      workflowId,
      draftId,
      currentState: WorkflowState.IDLE,
      iterationCount: 0,
      maxIterations: 3,
      metadata: {}
    };
  }
}
