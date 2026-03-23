// Capability Twin — create, validate, diff

export function createCapability(input) {
  return {
    _type: 'capability',
    _created_at: new Date().toISOString(),
    ...input,
  };
}

export function validateCapability(twin) {
  const errors = [];

  if (!twin.mission_id || typeof twin.mission_id !== 'string') {
    errors.push('mission_id is required');
  }

  if (twin.title && twin.title.length > 200) {
    errors.push('title must be <= 200 characters');
  }

  const VALID_STATUSES = ['draft', 'active'];
  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (twin.sort_order !== undefined && twin.sort_order < 0) {
    errors.push('sort_order must be >= 0');
  }

  return { valid: errors.length === 0, errors };
}

export function diffCapability(current, original) {
  const diff = {};
  for (const key of Object.keys(current)) {
    if (key.startsWith('_')) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      diff[key] = { old: original[key], new: current[key] };
    }
  }
  return diff;
}
