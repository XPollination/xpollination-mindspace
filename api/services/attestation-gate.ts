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
    // Check if there's a rejected attestation with structured feedback
    const rejected = db.prepare(
      "SELECT * FROM attestations WHERE task_slug = ? AND project_slug = ? AND status = 'rejected' ORDER BY updated_at DESC LIMIT 1"
    ).get(taskSlug, projectSlug) as any;

    if (rejected?.rejection_reason) {
      // Include structured rejection details in gate reason
      try {
        const parsed = JSON.parse(rejected.rejection_reason);
        const failedRules = parsed.checks_failed?.map((c: any) => c.rule).join(', ') || '';
        return {
          allowed: false,
          reason: `Attestation rejected: ${parsed.summary}. Failed: ${failedRules}`
        };
      } catch {
        // Fall through to generic message if JSON parse fails
      }
    }

    return {
      allowed: false,
      reason: `Attestation required for transition ${fromStatus}->${toStatus} but no valid attestation found`
    };
  }

  return { allowed: true, reason: null };
}
