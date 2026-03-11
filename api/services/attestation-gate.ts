import { getDb } from '../db/connection.js';

interface GateResult {
  allowed: boolean;
  reason: string | null;
}

/**
 * Check attestation gate for a transition.
 * If no rules are configured for the project/capability, the transition is allowed by default (skip gate).
 * If rules exist, a valid attestation must be present for the task.
 */
export function checkAttestationGate(
  taskSlug: string,
  projectSlug: string,
  fromStatus: string,
  toStatus: string
): GateResult {
  const db = getDb();

  // Check if attestation rules are configured for this project
  const rules = db.prepare(
    'SELECT * FROM attestation_rules WHERE project_slug = ? AND from_status = ? AND to_status = ?'
  ).get(projectSlug, fromStatus, toStatus) as any;

  // No rules configured — default allow, skip gate
  if (!rules) {
    return { allowed: true, reason: null };
  }

  // Rules exist — check for a valid attestation
  const attestation = db.prepare(
    'SELECT * FROM attestations WHERE task_slug = ? AND project_slug = ? AND valid = 1 ORDER BY created_at DESC LIMIT 1'
  ).get(taskSlug, projectSlug) as any;

  if (!attestation) {
    return {
      allowed: false,
      reason: `Attestation required for transition ${fromStatus}->${toStatus} but no valid attestation found`
    };
  }

  return { allowed: true, reason: null };
}
