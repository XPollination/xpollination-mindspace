/**
 * Unified Validation (All 4 Layers)
 *
 * Runs all validation layers in sequence:
 * 1. JSON Syntax - Is it valid JSON?
 * 2. Schema - Does it match the expected structure?
 * 3. Semantic - Do values make sense?
 * 4. Graph - Is the DAG structure valid?
 */

import { NodeType, NodeStatus, Actor } from '../StateMachineValidator.js';
import { validateJsonSyntax, validateDnaSchema, DnaValidationResult } from './DnaValidator.js';
import { validateSemantics, SemanticValidationContext, SemanticValidationResult } from './DnaSemanticValidator.js';
import { validateNodeInGraph, GraphContext, GraphNode, GraphValidationResult } from './DnaGraphValidator.js';

/**
 * Validation layer names
 */
export type ValidationLayer = 'syntax' | 'schema' | 'semantic' | 'graph';

/**
 * Result for a single validation layer
 */
export interface LayerResult {
  layer: ValidationLayer;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Complete validation result
 */
export interface FullValidationResult {
  valid: boolean;
  layers: LayerResult[];
  allErrors: string[];
  allWarnings: string[];
  failedAt?: ValidationLayer;
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  stopOnFirstFailure?: boolean;  // Stop at first layer that fails
  skipLayers?: ValidationLayer[]; // Layers to skip
  graphContext?: GraphContext;   // Required for layer 4
}

/**
 * Context for full validation
 */
export interface FullValidationContext {
  nodeId: string;
  nodeType: NodeType;
  currentStatus: NodeStatus;
  targetStatus?: NodeStatus;
  actor: Actor;
  parentIds: string[];
}

/**
 * Run all 4 validation layers
 */
export async function validateAll(
  jsonString: string,
  context: FullValidationContext,
  options: ValidationOptions = {}
): Promise<FullValidationResult> {
  const layers: LayerResult[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let failedAt: ValidationLayer | undefined;
  const skipLayers = new Set(options.skipLayers || []);

  // Layer 1: JSON Syntax
  if (!skipLayers.has('syntax')) {
    const syntaxResult = validateJsonSyntax(jsonString);
    const layer1: LayerResult = {
      layer: 'syntax',
      valid: syntaxResult.valid,
      errors: syntaxResult.errors,
      warnings: []
    };
    layers.push(layer1);
    allErrors.push(...layer1.errors);

    if (!syntaxResult.valid) {
      failedAt = 'syntax';
      if (options.stopOnFirstFailure) {
        return { valid: false, layers, allErrors, allWarnings, failedAt };
      }
    }
  }

  // Parse JSON for subsequent layers (if syntax passed)
  let dna: Record<string, unknown>;
  try {
    dna = JSON.parse(jsonString);
  } catch {
    // If syntax validation was skipped but JSON is invalid
    return {
      valid: false,
      layers,
      allErrors: [...allErrors, 'Cannot parse JSON for further validation'],
      allWarnings,
      failedAt: failedAt || 'syntax'
    };
  }

  // Layer 2: Schema Validation
  if (!skipLayers.has('schema')) {
    const schemaResult = validateDnaSchema(context.nodeType, dna);
    const layer2: LayerResult = {
      layer: 'schema',
      valid: schemaResult.valid,
      errors: schemaResult.errors,
      warnings: []
    };
    layers.push(layer2);
    allErrors.push(...layer2.errors);

    if (!schemaResult.valid && !failedAt) {
      failedAt = 'schema';
      if (options.stopOnFirstFailure) {
        return { valid: false, layers, allErrors, allWarnings, failedAt };
      }
    }
  }

  // Layer 3: Semantic Validation
  if (!skipLayers.has('semantic')) {
    const semanticContext: SemanticValidationContext = {
      nodeType: context.nodeType,
      currentStatus: context.currentStatus,
      targetStatus: context.targetStatus,
      actor: context.actor
    };

    const semanticResult = validateSemantics(dna, semanticContext);
    const layer3: LayerResult = {
      layer: 'semantic',
      valid: semanticResult.valid,
      errors: semanticResult.errors,
      warnings: semanticResult.warnings
    };
    layers.push(layer3);
    allErrors.push(...layer3.errors);
    allWarnings.push(...layer3.warnings);

    if (!semanticResult.valid && !failedAt) {
      failedAt = 'semantic';
      if (options.stopOnFirstFailure) {
        return { valid: false, layers, allErrors, allWarnings, failedAt };
      }
    }
  }

  // Layer 4: Graph Validation (requires context)
  if (!skipLayers.has('graph') && options.graphContext) {
    const graphNode: GraphNode = {
      id: context.nodeId,
      type: context.nodeType,
      parentIds: context.parentIds,
      dna
    };

    const graphResult = await validateNodeInGraph(graphNode, options.graphContext);
    const layer4: LayerResult = {
      layer: 'graph',
      valid: graphResult.valid,
      errors: graphResult.errors,
      warnings: graphResult.warnings
    };
    layers.push(layer4);
    allErrors.push(...layer4.errors);
    allWarnings.push(...layer4.warnings);

    if (!graphResult.valid && !failedAt) {
      failedAt = 'graph';
    }
  }

  return {
    valid: allErrors.length === 0,
    layers,
    allErrors,
    allWarnings,
    failedAt
  };
}

/**
 * Quick validation (layers 1-3 only, no graph)
 */
export function validateQuick(
  jsonString: string,
  nodeType: NodeType,
  status: NodeStatus,
  actor: Actor
): FullValidationResult {
  // This is synchronous since it doesn't include graph validation
  const context: FullValidationContext = {
    nodeId: 'temp',
    nodeType,
    currentStatus: status,
    actor,
    parentIds: []
  };

  // Run synchronously by using a fake async wrapper
  let result: FullValidationResult | undefined;

  // Since layers 1-3 are synchronous, we can cheat a bit
  const syntaxResult = validateJsonSyntax(jsonString);
  const layers: LayerResult[] = [{
    layer: 'syntax',
    valid: syntaxResult.valid,
    errors: syntaxResult.errors,
    warnings: []
  }];

  if (!syntaxResult.valid) {
    return {
      valid: false,
      layers,
      allErrors: syntaxResult.errors,
      allWarnings: [],
      failedAt: 'syntax'
    };
  }

  const dna = JSON.parse(jsonString);

  const schemaResult = validateDnaSchema(nodeType, dna);
  layers.push({
    layer: 'schema',
    valid: schemaResult.valid,
    errors: schemaResult.errors,
    warnings: []
  });

  if (!schemaResult.valid) {
    return {
      valid: false,
      layers,
      allErrors: schemaResult.errors,
      allWarnings: [],
      failedAt: 'schema'
    };
  }

  const semanticContext: SemanticValidationContext = {
    nodeType,
    currentStatus: status,
    actor
  };
  const semanticResult = validateSemantics(dna, semanticContext);
  layers.push({
    layer: 'semantic',
    valid: semanticResult.valid,
    errors: semanticResult.errors,
    warnings: semanticResult.warnings
  });

  return {
    valid: semanticResult.valid,
    layers,
    allErrors: semanticResult.errors,
    allWarnings: semanticResult.warnings,
    failedAt: semanticResult.valid ? undefined : 'semantic'
  };
}

/**
 * Validate for a specific layer only
 */
export async function validateLayer(
  layer: ValidationLayer,
  jsonString: string,
  context: FullValidationContext,
  graphContext?: GraphContext
): Promise<LayerResult> {
  switch (layer) {
    case 'syntax': {
      const result = validateJsonSyntax(jsonString);
      return { layer, valid: result.valid, errors: result.errors, warnings: [] };
    }

    case 'schema': {
      let dna: unknown;
      try {
        dna = JSON.parse(jsonString);
      } catch (e) {
        return { layer, valid: false, errors: ['Invalid JSON'], warnings: [] };
      }
      const result = validateDnaSchema(context.nodeType, dna);
      return { layer, valid: result.valid, errors: result.errors, warnings: [] };
    }

    case 'semantic': {
      let dna: Record<string, unknown>;
      try {
        dna = JSON.parse(jsonString);
      } catch {
        return { layer, valid: false, errors: ['Invalid JSON'], warnings: [] };
      }
      const semanticContext: SemanticValidationContext = {
        nodeType: context.nodeType,
        currentStatus: context.currentStatus,
        targetStatus: context.targetStatus,
        actor: context.actor
      };
      const result = validateSemantics(dna, semanticContext);
      return { layer, valid: result.valid, errors: result.errors, warnings: result.warnings };
    }

    case 'graph': {
      if (!graphContext) {
        return { layer, valid: false, errors: ['Graph context required'], warnings: [] };
      }
      let dna: Record<string, unknown>;
      try {
        dna = JSON.parse(jsonString);
      } catch {
        return { layer, valid: false, errors: ['Invalid JSON'], warnings: [] };
      }
      const graphNode: GraphNode = {
        id: context.nodeId,
        type: context.nodeType,
        parentIds: context.parentIds,
        dna
      };
      const result = await validateNodeInGraph(graphNode, graphContext);
      return { layer, valid: result.valid, errors: result.errors, warnings: result.warnings };
    }
  }
}
