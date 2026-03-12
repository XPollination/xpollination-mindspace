import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';
import { sendToAgent } from '../lib/sse-manager.js';
import { SUGGESTION_MAP } from '../services/attestation-rules.js';

/**
 * Request an attestation from an agent before allowing a transition.
 * Creates a pending attestation record and pushes an SSE ATTESTATION_REQUIRED event.
 */
export function requestAttestation(params: {
  task_id: string;
  project_slug: string;
  agent_id: string;
  from_status: string;
  to_status: string;
  rules_version?: string;
  required_checks: string[];
}): any {
  const db = getDb();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO attestations (id, task_id, project_slug, agent_id, from_status, to_status, rules_version, required_checks, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    id,
    params.task_id,
    params.project_slug,
    params.agent_id,
    params.from_status,
    params.to_status,
    params.rules_version || null,
    JSON.stringify(params.required_checks)
  );

  const attestation = db.prepare('SELECT * FROM attestations WHERE id = ?').get(id);

  // Push SSE notification to the agent
  sendToAgent(params.agent_id, 'attestation', {
    type: 'ATTESTATION_REQUIRED',
    attestation_id: id,
    task_id: params.task_id,
    from_status: params.from_status,
    to_status: params.to_status,
    rules_version: params.rules_version || null,
    required_checks: params.required_checks
  });

  return attestation;
}

/**
 * Resolve an attestation (accept or reject).
 */
export function resolveAttestation(params: {
  attestation_id: string;
  status: 'accepted' | 'rejected';
  submitted_checks?: string[];
  rejection_reason?: string;
}): any {
  const db = getDb();

  db.prepare(
    `UPDATE attestations SET status = ?, submitted_checks = ?, rejection_reason = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    params.status,
    params.submitted_checks ? JSON.stringify(params.submitted_checks) : null,
    params.rejection_reason || null,
    params.attestation_id
  );

  return db.prepare('SELECT * FROM attestations WHERE id = ?').get(params.attestation_id);
}

/**
 * Get a single attestation by ID.
 */
export function getAttestation(attestation_id: string): any {
  const db = getDb();
  return db.prepare('SELECT * FROM attestations WHERE id = ?').get(attestation_id);
}

/**
 * Get all pending attestations for an agent.
 */
export function getPendingAttestations(agent_id: string): any[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM attestations WHERE agent_id = ? AND status = 'pending' ORDER BY created_at DESC"
  ).all(agent_id);
}

/**
 * Reject an attestation with structured feedback.
 * Stores JSON rejection_reason with failed checks + suggestions, emits ATTESTATION_REJECTED SSE.
 */
export function rejectWithFeedback(
  attestation_id: string,
  validationResults: Array<{ rule: string; passed: boolean; message?: string }>
): any {
  const db = getDb();

  const checksFailed = validationResults
    .filter(r => !r.passed)
    .map(r => ({
      rule: r.rule,
      passed: r.passed,
      message: r.message,
      suggestion: SUGGESTION_MAP[r.rule] || 'No suggestion available.'
    }));

  const total = validationResults.length;
  const failedCount = checksFailed.length;
  const summary = `${failedCount} of ${total} checks failed`;

  const rejectionReason = JSON.stringify({ checks_failed: checksFailed, summary });

  db.prepare(
    `UPDATE attestations SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(rejectionReason, attestation_id);

  const attestation = db.prepare('SELECT * FROM attestations WHERE id = ?').get(attestation_id) as any;

  // Emit ATTESTATION_REJECTED SSE event
  if (attestation?.agent_id) {
    sendToAgent(attestation.agent_id, 'attestation', {
      type: 'ATTESTATION_REJECTED',
      attestation_id,
      task_id: attestation.task_id,
      checks_failed: checksFailed,
      summary
    });
  }

  return attestation;
}
