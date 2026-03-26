// Workspace Twin — portable cross-station workspace
// The workspace is a twin that materializes wherever the user docks.
// Files are cache. The twin IS the workspace.

const VALID_STATUSES = ['docked', 'undocked', 'archived'];

export function createWorkspace(input) {
  const now = new Date().toISOString();
  return {
    _type: 'workspace',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
    status: input.status || 'undocked',
  };
}

export function validateWorkspace(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.user_id) {
    errors.push('user_id is required');
  }

  if (!Array.isArray(twin.git_urls) || twin.git_urls.length === 0) {
    errors.push('git_urls[] is required — at least one repository');
  }

  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (twin.status === 'docked' && !twin.station_id) {
    warnings.push('docked workspace should have station_id');
  }

  if (!twin.permissions || typeof twin.permissions !== 'object') {
    warnings.push('permissions object missing — workspace has no access control');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function diffWorkspace(current, original) {
  const changes = [];
  const fields = ['status', 'git_urls', 'branch_state', 'agent_sessions', 'permissions'];
  for (const field of fields) {
    const c = JSON.stringify(current[field]);
    const o = JSON.stringify(original[field]);
    if (c !== o) {
      changes.push({ field, from: original[field], to: current[field] });
    }
  }
  return { changed: changes.length > 0, changes };
}
