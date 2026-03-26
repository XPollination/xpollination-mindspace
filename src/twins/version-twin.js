// Version Twin — deployment as twin transition
// Each version carries viz_path, migrations, feature_flags, apply/rollback steps.
// Station reads the twin and applies it in seconds (no Docker rebuild).

const VALID_STATUSES = ['draft', 'applied', 'rolled_back'];
const SEMVER_RE = /^v?\d+\.\d+\.\d+$/;

export function createVersion(input) {
  const now = new Date().toISOString();
  return {
    _type: 'version',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
    status: input.status || 'draft',
    requires_rebuild: input.requires_rebuild || false,
  };
}

export function validateVersion(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.version || !SEMVER_RE.test(twin.version)) {
    errors.push('version is required and must be semver (e.g., v0.0.39)');
  }

  if (!twin.viz_path) {
    errors.push('viz_path is required (e.g., viz/versions/v0.0.39)');
  }

  if (!Array.isArray(twin.apply_steps) || twin.apply_steps.length === 0) {
    errors.push('apply_steps[] is required — at least one step');
  } else {
    const validTypes = ['migration', 'symlink', 'feature_flags', 'restart', 'config'];
    for (const step of twin.apply_steps) {
      if (!validTypes.includes(step.type)) {
        errors.push(`apply_step type '${step.type}' not recognized. Valid: ${validTypes.join(', ')}`);
      }
    }
  }

  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (!twin.parent_version && twin.version !== 'v0.0.1') {
    warnings.push('parent_version missing — version not linked to chain');
  }

  if (!twin.changelog) {
    warnings.push('changelog missing — version has no description');
  }

  if (twin.requires_rebuild) {
    warnings.push('requires_rebuild=true — Docker rebuild needed for this version');
  }

  if (!Array.isArray(twin.rollback_steps) || twin.rollback_steps.length === 0) {
    warnings.push('rollback_steps[] empty — version cannot be rolled back');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function diffVersion(current, original) {
  const changes = [];
  const fields = ['version', 'viz_path', 'migrations', 'feature_flags', 'config_defaults', 'apply_steps', 'rollback_steps', 'requires_rebuild', 'changelog'];
  for (const field of fields) {
    const c = JSON.stringify(current[field]);
    const o = JSON.stringify(original[field]);
    if (c !== o) {
      changes.push({ field, from: original[field], to: current[field] });
    }
  }
  return { changed: changes.length > 0, changes };
}
