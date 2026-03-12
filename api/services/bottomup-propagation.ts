import { getDb } from '../db/connection.js';
import { randomUUID } from 'node:crypto';

interface TestChangeInput {
  test_file: string;
  project_slug: string;
  affected_attestation_ids: string[];
  requirement_refs?: string[];
}

interface PropagationResult {
  invalidated_count: number;
  suspect_links_created: number;
  approval_requests_created: number;
  details: Array<{
    attestation_id: string;
    suspect_link_id?: string;
    approval_request_id?: string;
  }>;
}

/**
 * Bottom-up suspect propagation: when a test file changes,
 * invalidate affected attestations, create suspect links (test→requirement),
 * and create approval requests for re-approval.
 *
 * Flow:
 * 1. For each affected attestation, set valid=0
 * 2. Create suspect links from test to each requirement ref
 * 3. Create approval requests for human re-approval
 * 4. Return summary
 */
export async function propagateTestChange(input: TestChangeInput): Promise<PropagationResult> {
  const db = getDb();
  const { test_file, project_slug, affected_attestation_ids, requirement_refs } = input;

  let invalidated_count = 0;
  let approval_requests_created = 0;
  const details: PropagationResult['details'] = [];
  const suspectLinkIds: string[] = [];

  for (const attId of affected_attestation_ids) {
    // Invalidate the attestation
    const result = db.prepare(
      `UPDATE attestations SET valid = 0, updated_at = datetime('now')
       WHERE id = ? AND project_slug = ?`
    ).run(attId, project_slug);

    if (result.changes > 0) {
      invalidated_count++;

      const detail: { attestation_id: string; suspect_link_id?: string; approval_request_id?: string } = {
        attestation_id: attId
      };

      // Create suspect links from test to each requirement
      if (requirement_refs && requirement_refs.length > 0) {
        for (const reqRef of requirement_refs) {
          const suspectId = randomUUID();
          db.prepare(
            `INSERT INTO suspect_links (id, source_type, source_ref, target_type, target_ref, reason, status, project_slug)
             VALUES (?, 'test', ?, 'requirement', ?, ?, 'suspect', ?)`
          ).run(
            suspectId,
            test_file,
            reqRef,
            `Test file ${test_file} changed. Requirement ${reqRef} verification basis invalidated.`,
            project_slug
          );
          suspectLinkIds.push(suspectId);
          detail.suspect_link_id = suspectId;
        }
      }

      // Create approval request for re-approval
      const att = db.prepare('SELECT task_id FROM attestations WHERE id = ?').get(attId) as any;
      if (att) {
        const approvalId = randomUUID();
        db.prepare(
          `INSERT INTO approval_requests (id, task_id, project_slug, status, reason)
           VALUES (?, ?, ?, 'pending', ?)`
        ).run(
          approvalId,
          att.task_id,
          project_slug,
          `Test file ${test_file} changed. Re-approval needed for attestation ${attId}.`
        );
        approval_requests_created++;
        detail.approval_request_id = approvalId;
      }

      details.push(detail);
    }
  }

  return {
    invalidated_count,
    suspect_links_created: suspectLinkIds.length,
    approval_requests_created,
    details
  };
}
