/**
 * DNA Semantic Validator (Layer 3)
 *
 * Validates that DNA field values make semantic sense:
 * - Date formats and logical constraints
 * - Actor permissions for operations
 * - Status-specific field requirements
 * - Business rule validation
 */

import { NodeType, NodeStatus, Actor, validateTransition } from '../StateMachineValidator.js';
import { canWork, canTransition } from '../AgentPermissions.js';

/**
 * Semantic validation result
 */
export interface SemanticValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Context for semantic validation
 */
export interface SemanticValidationContext {
  nodeType: NodeType;
  currentStatus: NodeStatus;
  targetStatus?: NodeStatus;  // If validating a transition
  actor: Actor;
}

/**
 * Validate DNA semantics for a node
 */
export function validateSemantics(
  dna: Record<string, unknown>,
  context: SemanticValidationContext
): SemanticValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate date fields
  validateDateFields(dna, errors, warnings);

  // Validate title length constraints
  validateTitleConstraints(dna, errors, warnings);

  // Validate description constraints
  validateDescriptionConstraints(dna, errors, warnings);

  // Validate status-specific requirements
  validateStatusRequirements(dna, context, errors, warnings);

  // Validate actor permissions
  validateActorPermissions(context, errors);

  // Type-specific semantic validation
  switch (context.nodeType) {
    case 'task':
      validateTaskSemantics(dna, context, errors, warnings);
      break;
    case 'decision':
      validateDecisionSemantics(dna, context, errors, warnings);
      break;
    case 'test':
      validateTestSemantics(dna, context, errors, warnings);
      break;
    case 'requirement':
      validateRequirementSemantics(dna, context, errors, warnings);
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate a status transition with semantic context
 */
export function validateTransitionSemantics(
  dna: Record<string, unknown>,
  nodeType: NodeType,
  fromStatus: NodeStatus,
  toStatus: NodeStatus,
  actor: Actor
): SemanticValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // First check if transition is valid per state machine
  const transitionResult = validateTransition({
    nodeType,
    fromStatus,
    toStatus,
    actor
  });

  if (!transitionResult.allowed) {
    errors.push(transitionResult.reason || 'Invalid transition');
    return { valid: false, errors, warnings };
  }

  // Check actor can perform transition
  const permResult = canTransition(nodeType, fromStatus, actor);
  if (!permResult.allowed) {
    errors.push(permResult.reason || 'Actor cannot perform transition');
    return { valid: false, errors, warnings };
  }

  // Transition-specific semantic validation
  validateTransitionRequirements(dna, nodeType, fromStatus, toStatus, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper validators

function validateDateFields(
  dna: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): void {
  // Check decided_at for decisions
  if (typeof dna.decided_at === 'string') {
    const date = new Date(dna.decided_at);
    if (isNaN(date.getTime())) {
      errors.push('"decided_at" is not a valid date format');
    } else if (date > new Date()) {
      warnings.push('"decided_at" is in the future');
    }
  }

  // Check due_date if present
  if (typeof dna.due_date === 'string') {
    const date = new Date(dna.due_date);
    if (isNaN(date.getTime())) {
      errors.push('"due_date" is not a valid date format');
    }
  }
}

function validateTitleConstraints(
  dna: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): void {
  if (typeof dna.title === 'string') {
    const title = dna.title.trim();

    if (title.length < 3) {
      errors.push('Title must be at least 3 characters');
    }

    if (title.length > 200) {
      errors.push('Title must be at most 200 characters');
    }

    if (title.length > 100) {
      warnings.push('Title is quite long (>100 chars), consider shortening');
    }
  }
}

function validateDescriptionConstraints(
  dna: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): void {
  if (typeof dna.description === 'string') {
    if (dna.description.length > 10000) {
      errors.push('Description must be at most 10000 characters');
    }
  }
}

function validateStatusRequirements(
  dna: Record<string, unknown>,
  context: SemanticValidationContext,
  errors: string[],
  warnings: string[]
): void {
  const { currentStatus, nodeType } = context;

  // Complete status requires certain fields to be filled
  if (currentStatus === 'complete') {
    // Tasks should have acceptance criteria verified
    if (nodeType === 'task') {
      if (!dna.acceptance_criteria || (dna.acceptance_criteria as string[]).length === 0) {
        warnings.push('Completed task has no acceptance criteria defined');
      }
    }

    // Decisions should have decision and rationale
    if (nodeType === 'decision') {
      if (!dna.decision) {
        errors.push('Completed decision must have a "decision" value');
      }
      if (!dna.rationale) {
        warnings.push('Completed decision should have a rationale');
      }
      if (!dna.decided_by) {
        warnings.push('Completed decision should record who decided');
      }
    }

    // Tests should have pass/fail result
    if (nodeType === 'test') {
      if (dna.pass === undefined) {
        errors.push('Completed test must have a "pass" result (true/false)');
      }
    }
  }

  // Review status: should have something to review
  if (currentStatus === 'review') {
    if (nodeType === 'test' && !dna.actual_result) {
      warnings.push('Test in review should have an actual_result');
    }
  }
}

function validateActorPermissions(
  context: SemanticValidationContext,
  errors: string[]
): void {
  const { nodeType, currentStatus, actor } = context;

  const workResult = canWork(nodeType, currentStatus, actor);
  if (!workResult.allowed) {
    errors.push(workResult.reason || `Actor "${actor}" cannot work on this node`);
  }
}

function validateTaskSemantics(
  dna: Record<string, unknown>,
  context: SemanticValidationContext,
  errors: string[],
  warnings: string[]
): void {
  // Estimate format validation
  if (typeof dna.estimate === 'string') {
    const estimate = dna.estimate.trim();
    // Simple pattern: number + unit (h, d, w, m)
    if (!/^\d+(\.\d+)?\s*(h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|m|mo|month|months)?$/i.test(estimate)) {
      warnings.push('Estimate format unclear. Recommended: "2h", "1d", "2w"');
    }
  }

  // Assignee should be a valid actor for active tasks
  if (context.currentStatus === 'active' && !dna.assignee) {
    warnings.push('Active task should have an assignee');
  }
}

function validateDecisionSemantics(
  dna: Record<string, unknown>,
  context: SemanticValidationContext,
  errors: string[],
  warnings: string[]
): void {
  // Options should exist before deciding
  if (dna.decision && (!dna.options || (dna.options as string[]).length === 0)) {
    warnings.push('Decision made without documented options');
  }

  // Decision should be one of the options (if options exist)
  if (dna.decision && dna.options && Array.isArray(dna.options)) {
    const options = dna.options as string[];
    if (!options.includes(dna.decision as string)) {
      warnings.push('Decision value is not one of the documented options');
    }
  }

  // decided_by should be thomas for decisions
  if (dna.decided_by && dna.decided_by !== 'thomas') {
    warnings.push('Decisions should typically be made by thomas');
  }
}

function validateTestSemantics(
  dna: Record<string, unknown>,
  context: SemanticValidationContext,
  errors: string[],
  warnings: string[]
): void {
  // Tests should have steps
  if (!dna.steps || (dna.steps as string[]).length === 0) {
    warnings.push('Test has no steps defined');
  }

  // Expected result should be defined
  if (!dna.expected_result) {
    warnings.push('Test has no expected_result defined');
  }

  // If pass is set, actual_result should be set
  if (dna.pass !== undefined && !dna.actual_result) {
    warnings.push('Test has pass/fail but no actual_result documented');
  }
}

function validateRequirementSemantics(
  dna: Record<string, unknown>,
  context: SemanticValidationContext,
  errors: string[],
  warnings: string[]
): void {
  // Requirements should have acceptance criteria
  if (!dna.acceptance_criteria || (dna.acceptance_criteria as string[]).length === 0) {
    warnings.push('Requirement has no acceptance criteria');
  }

  // Source is recommended
  if (!dna.source) {
    warnings.push('Requirement has no source documented');
  }
}

function validateTransitionRequirements(
  dna: Record<string, unknown>,
  nodeType: NodeType,
  fromStatus: NodeStatus,
  toStatus: NodeStatus,
  errors: string[],
  warnings: string[]
): void {
  // Transitioning to complete
  if (toStatus === 'complete') {
    if (nodeType === 'decision' && !dna.decision) {
      errors.push('Cannot complete decision without a decision value');
    }
    if (nodeType === 'test' && dna.pass === undefined) {
      errors.push('Cannot complete test without pass/fail result');
    }
  }

  // Transitioning to review
  if (toStatus === 'review') {
    if (nodeType === 'task' && !dna.acceptance_criteria) {
      warnings.push('Task going to review has no acceptance criteria to review against');
    }
  }

  // Transitioning from blocked to ready
  if (fromStatus === 'blocked' && toStatus === 'ready') {
    // This is fine, but warn if no explanation
    warnings.push('Consider documenting why the node is no longer blocked');
  }
}
