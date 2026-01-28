/**
 * Content Pipeline Process
 *
 * Defines the STATIC process that Claude follows.
 * Claude does NOT decide the flow - this class does.
 * Claude only provides input at gates and executes tools.
 */

import { WorkflowState } from '../states.js';
import { WorkflowContext } from '../transitions.js';
import { WorkflowEngine } from '../WorkflowEngine.js';

/**
 * Represents the next action Claude should take
 */
export interface PipelineAction {
  type: 'TOOL_CALL' | 'USER_GATE' | 'TRANSITION' | 'WAIT' | 'COMPLETE' | 'ERROR';
  tool?: string;
  description: string;
  expectedInput?: string;
  options?: string[];
  nextTrigger?: string;
}

/**
 * Result when pipeline reaches a user gate
 */
export interface GateResult {
  gateType: string;
  description: string;
  options?: string[];
  context?: Record<string, unknown>;
}

export class ContentPipeline {
  constructor(private engine: WorkflowEngine) {}

  /**
   * Get the next action Claude should take based on current state.
   * This is the STATIC process definition.
   */
  getNextAction(context: WorkflowContext): PipelineAction {
    switch (context.currentState) {
      // ============================================
      // INITIAL STATE
      // ============================================
      case WorkflowState.IDLE:
        return {
          type: 'TOOL_CALL',
          tool: 'crawl_trends',
          description: 'Start by crawling trends for active frames',
          nextTrigger: 'START_CRAWL'
        };

      // ============================================
      // TREND DISCOVERY
      // ============================================
      case WorkflowState.CRAWLING:
        return {
          type: 'WAIT',
          description: 'Crawling trends from configured sources...'
        };

      case WorkflowState.TRENDS_READY:
        return {
          type: 'TOOL_CALL',
          tool: 'propose_topic',
          description: 'Analyze trends and propose blog topics',
          nextTrigger: 'PROPOSE'
        };

      // ============================================
      // TOPIC SELECTION (USER GATE)
      // ============================================
      case WorkflowState.PROPOSING:
        return {
          type: 'WAIT',
          description: 'Generating topic proposals...'
        };

      case WorkflowState.AWAITING_TOPIC_SELECTION:
        return {
          type: 'USER_GATE',
          description: 'Present topic proposals to user for selection. ' +
            'User should select a topic and provide additional framing context.',
          expectedInput: 'Selected topic ID and user framing text',
          options: ['TOPIC_SELECTED', 'NO_TOPICS_SELECTED']
        };

      // ============================================
      // CONTENT GENERATION
      // ============================================
      case WorkflowState.TOPIC_SELECTED:
        return {
          type: 'TOOL_CALL',
          tool: 'write_draft',
          description: 'Generate draft content for selected topic',
          nextTrigger: 'START_DRAFT'
        };

      case WorkflowState.DRAFTING:
        return {
          type: 'WAIT',
          description: 'Writing draft content...'
        };

      case WorkflowState.DRAFT_READY:
        return {
          type: 'TOOL_CALL',
          tool: 'fact_check',
          description: 'Verify factual claims in the draft',
          nextTrigger: 'START_FACT_CHECK'
        };

      // ============================================
      // VERIFICATION LOOP
      // ============================================
      case WorkflowState.FACT_CHECKING:
        return {
          type: 'WAIT',
          description: 'Checking factual claims against sources...'
        };

      case WorkflowState.FACT_CHECK_PASSED:
        return {
          type: 'TRANSITION',
          description: 'Fact-check passed! Proceeding to user approval.',
          nextTrigger: 'REQUEST_APPROVAL'
        };

      case WorkflowState.FACT_CHECK_FAILED:
        if (context.iterationCount < context.maxIterations) {
          return {
            type: 'TOOL_CALL',
            tool: 'improve_draft',
            description: `Fixing fact-check issues (iteration ${context.iterationCount + 1}/${context.maxIterations})`,
            nextTrigger: 'START_IMPROVEMENT'
          };
        } else {
          return {
            type: 'TRANSITION',
            description: 'Maximum iterations reached. Escalating to user.',
            nextTrigger: 'MAX_ITERATIONS'
          };
        }

      case WorkflowState.IMPROVING:
        return {
          type: 'WAIT',
          description: 'Improving draft based on fact-check feedback...'
        };

      // ============================================
      // APPROVAL (USER GATE)
      // ============================================
      case WorkflowState.AWAITING_APPROVAL:
        return {
          type: 'USER_GATE',
          description: 'Present final draft to user for approval. ' +
            'Show the complete content and fact-check results.',
          expectedInput: 'User decision: approve, reject, or request changes',
          options: ['USER_APPROVED', 'USER_REJECTED', 'USER_REQUESTS_CHANGES']
        };

      case WorkflowState.MAX_ITERATIONS_REACHED:
        return {
          type: 'USER_GATE',
          description: 'Maximum fact-check iterations reached. ' +
            'Content still has issues. User must decide whether to review anyway or abandon.',
          expectedInput: 'User decision: review anyway or abandon',
          options: ['USER_REVIEW_ANYWAY', 'USER_ABANDON']
        };

      // ============================================
      // PUBLISHING
      // ============================================
      case WorkflowState.APPROVED:
        return {
          type: 'TOOL_CALL',
          tool: 'publish_post',
          description: 'Publishing approved content to Hugo site',
          nextTrigger: 'START_PUBLISH'
        };

      case WorkflowState.PUBLISHING:
        return {
          type: 'WAIT',
          description: 'Publishing to Hugo site and triggering deploy...'
        };

      // ============================================
      // TERMINAL STATES
      // ============================================
      case WorkflowState.PUBLISHED:
        return {
          type: 'COMPLETE',
          description: 'Content published successfully! Post is now live.',
          nextTrigger: 'RESET'
        };

      case WorkflowState.REJECTED:
        return {
          type: 'COMPLETE',
          description: 'Content rejected by user.',
          nextTrigger: 'RESET'
        };

      case WorkflowState.ERROR:
        return {
          type: 'ERROR',
          description: 'Workflow encountered an error. Reset to try again.',
          nextTrigger: 'RESET'
        };

      default:
        throw new Error(`Unknown state: ${context.currentState}`);
    }
  }

  /**
   * Run the pipeline until a user gate or terminal state is reached
   */
  async runUntilGate(context: WorkflowContext): Promise<GateResult> {
    let currentContext = context;

    while (true) {
      const action = this.getNextAction(currentContext);

      // User gate - return and wait for input
      if (action.type === 'USER_GATE') {
        return {
          gateType: currentContext.currentState,
          description: action.description,
          options: action.options
        };
      }

      // Terminal state - return completion
      if (action.type === 'COMPLETE' || action.type === 'ERROR') {
        if (action.nextTrigger) {
          await this.engine.transition(currentContext, action.nextTrigger);
        }
        return {
          gateType: 'COMPLETE',
          description: action.description
        };
      }

      // Transition without tool call
      if (action.type === 'TRANSITION' && action.nextTrigger) {
        const newState = await this.engine.transition(currentContext, action.nextTrigger);
        currentContext = {
          ...currentContext,
          currentState: newState
        };
        continue;
      }

      // Tool call - execute then continue
      if (action.type === 'TOOL_CALL' && action.nextTrigger) {
        await this.engine.transition(currentContext, action.nextTrigger);
        // Tool execution happens externally
        // After tool completes, it will trigger the next transition
        break;
      }

      // Wait state - should not reach here in normal flow
      if (action.type === 'WAIT') {
        return {
          gateType: 'WAITING',
          description: action.description
        };
      }

      break;
    }

    return {
      gateType: currentContext.currentState,
      description: 'Pipeline paused'
    };
  }

  /**
   * Resume pipeline after user input at a gate
   */
  async resumeFromGate(
    context: WorkflowContext,
    trigger: string,
    userInput?: Record<string, unknown>
  ): Promise<GateResult> {
    // Validate trigger is allowed at current state
    const validTriggers = this.engine.getAvailableTriggers(context);
    if (!validTriggers.includes(trigger)) {
      throw new Error(
        `Invalid trigger '${trigger}' for state '${context.currentState}'. ` +
        `Valid: ${validTriggers.join(', ')}`
      );
    }

    // Execute transition
    const newState = await this.engine.transition(context, trigger);

    // Update context
    const newContext: WorkflowContext = {
      ...context,
      currentState: newState,
      metadata: { ...context.metadata, ...userInput }
    };

    // Continue pipeline
    return this.runUntilGate(newContext);
  }
}
