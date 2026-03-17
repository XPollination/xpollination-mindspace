/**
 * Workflow Engine — API service wrapper
 *
 * Re-exports the full workflow engine with all gates:
 * - ALLOWED_TRANSITIONS with allowedActors, requiresDna, newRole
 * - validateTransition, validateDnaRequirements
 * - liaison_review gate, challenge questions, version_bump_ref gate
 * - pdsa_ref hard gate for dev/qa claiming
 */

// Import from the canonical workflow engine in src/db/
export {
  VALID_STATUSES,
  VALID_TYPES,
  VALID_ROLES,
  ALLOWED_TRANSITIONS,
  validateTransition,
  getNewRoleForTransition,
  getClearsDnaForTransition,
  validateType,
  validateDnaRequirements,
  EXPECTED_ROLES_BY_STATE,
  validateRoleConsistency,
  getHumanConfirmTransitions,
} from '../../src/db/workflow-engine.js';
