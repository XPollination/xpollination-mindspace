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
