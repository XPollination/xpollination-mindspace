import { getDb } from '../db/connection.js';
import { randomUUID } from 'node:crypto';

interface VersionCheckResult {
  valid: boolean;
  version_mismatch: boolean;
  attestation_version: number | null;
  current_version: number;
}

interface StaleAttestation {
  id: string;
  req_version: number;
  task_id: string;
  project_slug: string;
}

/**
 * Check if an attestation's req_version matches the current requirement version.
 * If mismatch: invalidates attestation (valid=0) and creates suspect link.
 */
export function checkAttestationVersion(
  attestationId: string,
  opts: { current_version: number }
): VersionCheckResult {
  const db = getDb();

  const att = db.prepare(
    'SELECT id, req_version, task_id, task_slug, project_slug, valid FROM attestations WHERE id = ?'
  ).get(attestationId) as any;

  if (!att) {
    return { valid: false, version_mismatch: false, attestation_version: null, current_version: opts.current_version };
  }

  const attVersion = att.req_version ?? null;
  const mismatch = attVersion !== null && attVersion !== opts.current_version;

  if (mismatch) {
    // Invalidate attestation
    db.prepare(
      "UPDATE attestations SET valid = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(attestationId);

    // Create suspect link
    const suspectId = randomUUID();
    db.prepare(
      `INSERT INTO suspect_links (id, source_type, source_ref, target_type, target_ref, reason, status, project_slug)
       VALUES (?, 'requirement', 'version-check', 'test', ?, ?, 'suspect', ?)`
    ).run(
      suspectId,
      attestationId,
      `Attestation version ${attVersion} does not match current requirement version ${opts.current_version}.`,
      att.project_slug
    );
  }

  return {
    valid: !mismatch,
    version_mismatch: mismatch,
    attestation_version: attVersion,
    current_version: opts.current_version
  };
}

/**
 * Scan all attestations in a project for stale versions.
 * Returns list of attestations where req_version < current version for their requirement.
 */
export function scanStaleAttestations(
  projectSlug: string,
  opts: { current_versions: Record<string, number> }
): StaleAttestation[] {
  const db = getDb();

  const attestations = db.prepare(
    "SELECT id, req_version, task_id, project_slug FROM attestations WHERE project_slug = ? AND valid = 1 AND req_version IS NOT NULL"
  ).all(projectSlug) as StaleAttestation[];

  const stale: StaleAttestation[] = [];
  for (const att of attestations) {
    // Check against any version in the current_versions map
    for (const [, version] of Object.entries(opts.current_versions)) {
      if (att.req_version < version) {
        stale.push(att);
        break;
      }
    }
  }

  return stale;
}
