/**
 * Mindspace Module
 *
 * Exports all mindspace-related functionality for the PM tool.
 */

// DNA validation
export {
  BaseDna,
  TaskDna,
  GroupDna,
  DecisionDna,
  RequirementDna,
  DesignDna,
  TestDna,
  NodeDna,
  DnaValidationResult,
  validateJsonSyntax,
  validateDnaSchema,
  validateDna,
  parseDna
} from './DnaValidator.js';

// Link resolution
export {
  NodeReference,
  NodeLookupFn,
  LinkResolutionResult,
  ResolvedLink,
  extractLinks,
  resolveLinks,
  checkCircularDependencies,
  getTransitiveDependencies,
  getDependents
} from './DnaLinkResolver.js';

// Semantic validation (Layer 3)
export {
  SemanticValidationResult,
  SemanticValidationContext,
  validateSemantics,
  validateTransitionSemantics
} from './DnaSemanticValidator.js';

// Graph validation (Layer 4)
export {
  GraphValidationResult,
  GraphNode,
  GraphContext,
  validateNodeInGraph,
  validateGraphStructure,
  wouldCreateCycle,
  getTopologicalOrder
} from './DnaGraphValidator.js';

// Unified validation (all 4 layers)
export {
  ValidationLayer,
  LayerResult,
  FullValidationResult,
  ValidationOptions,
  FullValidationContext,
  validateAll,
  validateQuick,
  validateLayer
} from './validateAll.js';
