/**
 * DNA Validator
 *
 * Validates node DNA JSON against schema definitions.
 * DNA contains the semantic content of a node (title, description, criteria, etc.)
 */

import { NodeType } from '../StateMachineValidator.js';

/**
 * Base DNA fields common to all node types
 */
export interface BaseDna {
  title: string;
  description?: string;
}

/**
 * Task DNA - work items with acceptance criteria
 */
export interface TaskDna extends BaseDna {
  acceptance_criteria?: string[];
  requirement_ref?: string;  // Reference to requirement node
  design_ref?: string;       // Reference to design node
  dependencies?: string[];   // References to other nodes this depends on
  assignee?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  estimate?: string;
}

/**
 * Group DNA - container for related nodes
 */
export interface GroupDna extends BaseDna {
  children?: string[];  // Node IDs contained in this group
}

/**
 * Decision DNA - decision points requiring human input
 */
export interface DecisionDna extends BaseDna {
  options?: string[];
  decision?: string;
  rationale?: string;
  decided_by?: string;
  decided_at?: string;
}

/**
 * Requirement DNA - specifications
 */
export interface RequirementDna extends BaseDna {
  acceptance_criteria?: string[];
  source?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Design DNA - technical designs
 */
export interface DesignDna extends BaseDna {
  requirement_ref?: string;  // Reference to requirement this implements
  approach?: string;
  alternatives_considered?: string[];
  diagrams?: string[];       // References to diagram files/URLs
}

/**
 * Test DNA - test cases
 */
export interface TestDna extends BaseDna {
  requirement_ref?: string;  // Reference to requirement being tested
  design_ref?: string;       // Reference to design being tested
  test_type?: 'unit' | 'integration' | 'e2e' | 'manual';
  steps?: string[];
  expected_result?: string;
  actual_result?: string;
  pass?: boolean;
}

/**
 * Union type for all DNA types
 */
export type NodeDna = TaskDna | GroupDna | DecisionDna | RequirementDna | DesignDna | TestDna;

/**
 * Validation result
 */
export interface DnaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate JSON syntax
 */
export function validateJsonSyntax(jsonString: string): DnaValidationResult {
  try {
    JSON.parse(jsonString);
    return { valid: true, errors: [] };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown JSON parse error';
    return { valid: false, errors: [`Invalid JSON syntax: ${message}`] };
  }
}

/**
 * Validate DNA schema for a specific node type
 */
export function validateDnaSchema(nodeType: NodeType, dna: unknown): DnaValidationResult {
  const errors: string[] = [];

  // Must be an object
  if (typeof dna !== 'object' || dna === null || Array.isArray(dna)) {
    return { valid: false, errors: ['DNA must be an object'] };
  }

  const obj = dna as Record<string, unknown>;

  // All nodes require title
  if (typeof obj.title !== 'string' || obj.title.trim() === '') {
    errors.push('DNA requires a non-empty "title" field');
  }

  // Description is optional but must be string if present
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    errors.push('"description" must be a string');
  }

  // Type-specific validation
  switch (nodeType) {
    case 'task':
      validateTaskDna(obj, errors);
      break;
    case 'group':
      validateGroupDna(obj, errors);
      break;
    case 'decision':
      validateDecisionDna(obj, errors);
      break;
    case 'requirement':
      validateRequirementDna(obj, errors);
      break;
    case 'design':
      validateDesignDna(obj, errors);
      break;
    case 'test':
      validateTestDna(obj, errors);
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate DNA from JSON string
 */
export function validateDna(nodeType: NodeType, jsonString: string): DnaValidationResult {
  // First check JSON syntax
  const syntaxResult = validateJsonSyntax(jsonString);
  if (!syntaxResult.valid) {
    return syntaxResult;
  }

  // Then validate schema
  const dna = JSON.parse(jsonString);
  return validateDnaSchema(nodeType, dna);
}

/**
 * Parse DNA from JSON string (throws if invalid)
 */
export function parseDna<T extends NodeDna>(nodeType: NodeType, jsonString: string): T {
  const result = validateDna(nodeType, jsonString);
  if (!result.valid) {
    throw new Error(`Invalid DNA: ${result.errors.join(', ')}`);
  }
  return JSON.parse(jsonString) as T;
}

// Type-specific validators

function validateTaskDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringArray(obj, 'acceptance_criteria', errors);
  validateStringRef(obj, 'requirement_ref', errors);
  validateStringRef(obj, 'design_ref', errors);
  validateStringArray(obj, 'dependencies', errors);
  validateOptionalString(obj, 'assignee', errors);
  validatePriority(obj, errors);
  validateOptionalString(obj, 'estimate', errors);
}

function validateGroupDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringArray(obj, 'children', errors);
}

function validateDecisionDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringArray(obj, 'options', errors);
  validateOptionalString(obj, 'decision', errors);
  validateOptionalString(obj, 'rationale', errors);
  validateOptionalString(obj, 'decided_by', errors);
  validateOptionalString(obj, 'decided_at', errors);
}

function validateRequirementDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringArray(obj, 'acceptance_criteria', errors);
  validateOptionalString(obj, 'source', errors);
  validatePriority(obj, errors);
}

function validateDesignDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringRef(obj, 'requirement_ref', errors);
  validateOptionalString(obj, 'approach', errors);
  validateStringArray(obj, 'alternatives_considered', errors);
  validateStringArray(obj, 'diagrams', errors);
}

function validateTestDna(obj: Record<string, unknown>, errors: string[]): void {
  validateStringRef(obj, 'requirement_ref', errors);
  validateStringRef(obj, 'design_ref', errors);
  if (obj.test_type !== undefined) {
    const validTypes = ['unit', 'integration', 'e2e', 'manual'];
    if (typeof obj.test_type !== 'string' || !validTypes.includes(obj.test_type)) {
      errors.push(`"test_type" must be one of: ${validTypes.join(', ')}`);
    }
  }
  validateStringArray(obj, 'steps', errors);
  validateOptionalString(obj, 'expected_result', errors);
  validateOptionalString(obj, 'actual_result', errors);
  if (obj.pass !== undefined && typeof obj.pass !== 'boolean') {
    errors.push('"pass" must be a boolean');
  }
}

// Helper validators

function validateStringArray(obj: Record<string, unknown>, field: string, errors: string[]): void {
  if (obj[field] !== undefined) {
    if (!Array.isArray(obj[field])) {
      errors.push(`"${field}" must be an array`);
    } else if (!obj[field].every((item: unknown) => typeof item === 'string')) {
      errors.push(`"${field}" must be an array of strings`);
    }
  }
}

function validateStringRef(obj: Record<string, unknown>, field: string, errors: string[]): void {
  if (obj[field] !== undefined && typeof obj[field] !== 'string') {
    errors.push(`"${field}" must be a string`);
  }
}

function validateOptionalString(obj: Record<string, unknown>, field: string, errors: string[]): void {
  if (obj[field] !== undefined && typeof obj[field] !== 'string') {
    errors.push(`"${field}" must be a string`);
  }
}

function validatePriority(obj: Record<string, unknown>, errors: string[]): void {
  if (obj.priority !== undefined) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (typeof obj.priority !== 'string' || !validPriorities.includes(obj.priority)) {
      errors.push(`"priority" must be one of: ${validPriorities.join(', ')}`);
    }
  }
}
