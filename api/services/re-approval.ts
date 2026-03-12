import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { broadcast } from '../lib/sse-manager.js';

interface ReApprovalParams {
  project_slug: string;
  suspect_link_id: string;
  reason: string;
  requested_by: string;
}

export function createReApprovalRequest(db: Database.Database, params: ReApprovalParams): any {
  const { project_slug, suspect_link_id, reason, requested_by } = params;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO approval_requests (id, project_slug, requested_by, reason, type, suspect_link_id)
     VALUES (?, ?, ?, ?, 're_approval', ?)`
  ).run(id, project_slug, requested_by, reason, suspect_link_id);

  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as any;

  broadcast({ type: 'RE_APPROVAL_NEEDED', approval_id: id, suspect_link_id, project_slug, reason });

  return approval;
}

export function approveReApproval(db: Database.Database, approvalId: string, decidedBy: string): any {
  // Update approval status
  db.prepare(
    `UPDATE approval_requests SET status = 'approved', decided_by = ?, decided_at = datetime('now') WHERE id = ?`
  ).run(decidedBy, approvalId);

  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId) as any;

  // Clear the linked suspect link
  if (approval?.suspect_link_id) {
    db.prepare(
      `UPDATE suspect_links SET status = 'cleared', cleared_by = ?, cleared_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(decidedBy, approval.suspect_link_id);
  }

  return approval;
}
