import { getDb } from '../db/connection.js';
import { randomUUID } from 'node:crypto';

interface PropagationInput {
  requirement_ref: string;
  project_slug: string;
  new_version: number;
  affected_attestation_ids: string[];
}

interface PropagationResult {
  invalidated_count: number;
  suspect_links_created: number;
  details: Array<{
    attestation_id: string;
    suspect_link_id: string;
  }>;
}

/**
 * Top-down suspect propagation: when a requirement changes version,
 * invalidate affected attestations and create suspect links.
 *
 * Flow:
 * 1. For each affected attestation ID, set valid=0
 * 2. Create a suspect link from requirement to the attestation's target (test scope)
 * 3. Return summary
 */
export async function propagateRequirementChange(input: PropagationInput): Promise<PropagationResult> {
  const db = getDb();
  const { requirement_ref, project_slug, new_version, affected_attestation_ids } = input;

  let invalidated_count = 0;
  const details: PropagationResult['details'] = [];

  for (const attId of affected_attestation_ids) {
    // Invalidate the attestation
    const result = db.prepare(
      `UPDATE attestations SET valid = 0, updated_at = datetime('now')
       WHERE id = ? AND project_slug = ?`
    ).run(attId, project_slug);

    if (result.changes > 0) {
      invalidated_count++;

      // Create a suspect link from requirement to test/code
      const suspectId = randomUUID();
      db.prepare(
        `INSERT INTO suspect_links (id, source_type, source_ref, target_type, target_ref, reason, status, project_slug)
         VALUES (?, 'requirement', ?, 'test', ?, ?, 'suspect', ?)`
      ).run(
        suspectId,
        requirement_ref,
        attId,
        `Requirement ${requirement_ref} changed to version ${new_version}. Attestation needs re-validation.`,
        project_slug
      );

      details.push({ attestation_id: attId, suspect_link_id: suspectId });
    }
  }

  return {
    invalidated_count,
    suspect_links_created: details.length,
    details
  };
}
